import { createServiceClient } from "@/lib/supabase/service";
import { getFiservProvider } from "@/lib/fiserv";

/**
 * POST /api/payments/3ds/challenge-callback
 * Called by the card issuer's ACS after cardholder completes 3DS challenge.
 * Receives form-encoded cRes + MD (merchant data containing paymentId).
 * Redirects back to the offering page with status.
 */
export async function POST(request: Request) {
  const service = createServiceClient();
  const origin = new URL(request.url).origin;

  try {
    const formData = await request.formData();
    const cRes = formData.get("cres") as string || formData.get("cRes") as string;
    const md = formData.get("MD") as string;

    if (!cRes) {
      return redirect(origin, "error", "Missing challenge response");
    }

    // Find the payment — MD contains our paymentId, or find by status
    let paymentId = md;
    let payment;

    if (paymentId) {
      const { data } = await service
        .from("payments")
        .select("id, fiserv_ipg_tx_id, fiserv_order_id, amount, currency, offering_id, investor_id, quantity")
        .eq("id", paymentId)
        .single();
      payment = data;
    } else {
      // Fallback: find most recent payment awaiting challenge
      const { data } = await service
        .from("payments")
        .select("id, fiserv_ipg_tx_id, fiserv_order_id, amount, currency, offering_id, investor_id, quantity")
        .eq("status", "requires_3ds")
        .eq("three_ds_type", "challenge")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      payment = data;
    }

    if (!payment) {
      return redirect(origin, "error", "Payment not found");
    }

    const fiserv = getFiservProvider();
    const result = await fiserv.complete3ds({
      type: "challenge_complete",
      transactionId: payment.fiserv_ipg_tx_id,
      cRes,
    });

    if (result.status === "approved") {
      const orderId = result.transactionId || payment.fiserv_order_id;
      const captureResult = await fiserv.capture(
        orderId,
        Number(payment.amount),
        payment.currency
      );

      if (captureResult.status === "captured") {
        await service
          .from("payments")
          .update({ status: "captured", fiserv_order_id: orderId })
          .eq("id", payment.id);

        const { data: offering } = await service
          .from("offerings")
          .select("price_per_share, agent_id")
          .eq("id", payment.offering_id)
          .single();

        await service.from("shares").insert({
          offering_id: payment.offering_id,
          investor_id: payment.investor_id,
          quantity: payment.quantity,
          purchase_price: offering?.price_per_share ?? Number(payment.amount) / payment.quantity,
          rail: "fiat",
          token_id: payment.id,
        });

        // Redirect to agent page with success
        const agentId = offering?.agent_id;
        return redirect(origin, "success", "Payment confirmed", agentId);
      }
    }

    // Declined or error
    await service
      .from("payments")
      .update({ status: result.status === "declined" ? "declined" : "error" })
      .eq("id", payment.id);

    return redirect(
      origin,
      "declined",
      result.declineReason ?? "Payment failed"
    );
  } catch (err) {
    console.error("[3ds/challenge-callback] error:", err);
    return redirect(origin, "error", "3DS verification failed");
  }
}

function redirect(
  origin: string,
  status: string,
  message: string,
  agentId?: string
) {
  const path = agentId ? `/agents/${agentId}` : "/dashboard";
  const url = new URL(path, origin);
  url.searchParams.set("payment", status);
  url.searchParams.set("message", message);

  return new Response(null, {
    status: 302,
    headers: { Location: url.toString() },
  });
}
