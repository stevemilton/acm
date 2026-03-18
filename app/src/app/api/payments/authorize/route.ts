import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getFiservProvider, FiservError } from "@/lib/fiserv";

export async function POST(request: Request) {
  const supabase = await createClient();
  const service = createServiceClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { paymentId, sessionId } = body as {
    paymentId: string;
    sessionId: string;
  };

  if (!paymentId || !sessionId) {
    return NextResponse.json(
      { error: "paymentId and sessionId required" },
      { status: 400 }
    );
  }

  // Load payment and verify ownership
  const { data: payment } = await service
    .from("payments")
    .select("*, investors!inner(user_id)")
    .eq("id", paymentId)
    .single();

  if (!payment) {
    return NextResponse.json(
      { error: "Payment not found" },
      { status: 404 }
    );
  }

  const investorUserId = (
    payment.investors as { user_id: string }
  )?.user_id;
  if (investorUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (payment.status !== "pending") {
    return NextResponse.json(
      { error: `Payment already ${payment.status}` },
      { status: 400 }
    );
  }

  const fiserv = getFiservProvider();
  const origin = new URL(request.url).origin;

  try {
    // Step 1: Complete tokenization
    const { tokenId, cardLast4, cardBrand } =
      await fiserv.completeTokenization(sessionId);

    await service
      .from("payments")
      .update({
        status: "tokenized",
        card_last4: cardLast4,
        card_brand: cardBrand,
        payment_token: tokenId,
      })
      .eq("id", paymentId);

    // Step 2: Authorize with 3DS
    const authResult = await fiserv.authorize({
      tokenId,
      amount: Number(payment.amount),
      currency: payment.currency,
      idempotencyKey: paymentId,
      termUrl: `${origin}/api/payments/3ds/challenge-callback`,
      methodNotificationUrl: `${origin}/api/payments/3ds/method-callback`,
    });

    if (authResult.status === "approved") {
      // Auto-capture
      const captureResult = await fiserv.capture(
        authResult.transactionId,
        Number(payment.amount),
        payment.currency
      );

      if (captureResult.status === "captured") {
        // Finalize: update payment, create shares, update counters
        await service
          .from("payments")
          .update({
            status: "captured",
            fiserv_order_id: authResult.transactionId,
          })
          .eq("id", paymentId);

        // Create share record
        const { data: offering } = await service
          .from("offerings")
          .select("price_per_share")
          .eq("id", payment.offering_id)
          .single();

        await service.from("shares").insert({
          offering_id: payment.offering_id,
          investor_id: payment.investor_id,
          quantity: payment.quantity,
          purchase_price: offering?.price_per_share ?? payment.amount / payment.quantity,
          rail: "fiat",
          token_id: paymentId,
        });

        await supabase.rpc("increment_shares_sold", {
          offering_id: payment.offering_id,
          quantity: payment.quantity,
        });

        await supabase.rpc("increment_investor_invested", {
          investor_id: payment.investor_id,
          amount: Number(payment.amount),
        });

        return NextResponse.json({
          status: "captured",
          paymentId,
        });
      }

      // Capture failed
      await service
        .from("payments")
        .update({ status: "error", fiserv_order_id: authResult.transactionId })
        .eq("id", paymentId);

      return NextResponse.json(
        { error: "Payment capture failed" },
        { status: 502 }
      );
    }

    if (authResult.status === "requires_action") {
      // 3DS required — save state and return to frontend
      await service
        .from("payments")
        .update({
          status: "requires_3ds",
          fiserv_order_id: authResult.transactionId,
          fiserv_ipg_tx_id: authResult.threeDsData?.ipgTransactionId,
          three_ds_type: authResult.threeDsData?.type,
          three_ds_data: authResult.threeDsData,
        })
        .eq("id", paymentId);

      return NextResponse.json({
        status: "requires_3ds",
        paymentId,
        threeDsType: authResult.threeDsData?.type,
        threeDsData: authResult.threeDsData,
      });
    }

    // Declined or error
    await service
      .from("payments")
      .update({
        status: authResult.status === "declined" ? "declined" : "error",
        fiserv_order_id: authResult.transactionId,
      })
      .eq("id", paymentId);

    return NextResponse.json(
      {
        status: authResult.status,
        error: authResult.declineReason ?? "Payment failed",
      },
      { status: authResult.status === "declined" ? 402 : 502 }
    );
  } catch (err) {
    console.error("[payments/authorize] error:", err);

    if (err instanceof FiservError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.httpStatus }
      );
    }

    return NextResponse.json(
      { error: "Payment processing failed" },
      { status: 502 }
    );
  }
}
