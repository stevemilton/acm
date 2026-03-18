import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getFiservProvider, FiservError } from "@/lib/fiserv";

/**
 * POST /api/payments/capture
 * Manual capture for payments that were authorized but not auto-captured.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const service = createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { paymentId } = body as { paymentId: string };

  if (!paymentId) {
    return NextResponse.json(
      { error: "paymentId required" },
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

  if (payment.status !== "authorized") {
    return NextResponse.json(
      { error: `Payment is ${payment.status}, not authorized` },
      { status: 400 }
    );
  }

  if (!payment.fiserv_order_id) {
    return NextResponse.json(
      { error: "No Fiserv order ID" },
      { status: 400 }
    );
  }

  try {
    const fiserv = getFiservProvider();
    const result = await fiserv.capture(
      payment.fiserv_order_id,
      Number(payment.amount),
      payment.currency
    );

    if (result.status === "captured") {
      await service
        .from("payments")
        .update({ status: "captured" })
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
        purchase_price: offering?.price_per_share ?? Number(payment.amount) / payment.quantity,
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

      return NextResponse.json({ status: "captured", paymentId });
    }

    return NextResponse.json(
      { error: "Capture failed" },
      { status: 502 }
    );
  } catch (err) {
    console.error("[payments/capture] error:", err);
    if (err instanceof FiservError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.httpStatus }
      );
    }
    return NextResponse.json(
      { error: "Capture failed" },
      { status: 502 }
    );
  }
}
