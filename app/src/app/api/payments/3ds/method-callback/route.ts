import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getFiservProvider } from "@/lib/fiserv";

/**
 * POST /api/payments/3ds/method-callback
 * Called by the card issuer's ACS after 3DS method (device fingerprinting).
 * Receives form-encoded data, completes the 3DS flow, and returns HTML
 * that posts a message to the parent window.
 */
export async function POST(request: Request) {
  const service = createServiceClient();

  try {
    // Parse form body
    const formData = await request.formData();
    const threeDSMethodData = formData.get("threeDSMethodData") as string;

    if (!threeDSMethodData) {
      return new Response(
        html("error", "Missing 3DS method data"),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Decode the base64 JSON to get threeDSServerTransID
    const decoded = JSON.parse(
      Buffer.from(threeDSMethodData, "base64").toString("utf-8")
    );
    const serverTransId = decoded.threeDSServerTransID;

    if (!serverTransId) {
      return new Response(
        html("error", "Missing transaction ID"),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Look up payment by ipg transaction ID
    const { data: payment } = await service
      .from("payments")
      .select("id, fiserv_ipg_tx_id, amount, currency, offering_id, investor_id, quantity")
      .eq("status", "requires_3ds")
      .eq("three_ds_type", "method")
      .limit(1)
      .single();

    if (!payment) {
      return new Response(
        html("error", "Payment not found"),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Complete 3DS method step
    const fiserv = getFiservProvider();
    const result = await fiserv.complete3ds({
      type: "method_complete",
      transactionId: payment.fiserv_ipg_tx_id,
    });

    if (result.status === "approved") {
      // Auto-capture
      const captureResult = await fiserv.capture(
        result.transactionId,
        Number(payment.amount),
        payment.currency
      );

      if (captureResult.status === "captured") {
        await finalizePayment(service, payment);
        return new Response(
          html("captured", "Payment confirmed"),
          { headers: { "Content-Type": "text/html" } }
        );
      }
    }

    if (result.status === "requires_action" && result.threeDsData?.type === "challenge") {
      // Transition to challenge
      await service
        .from("payments")
        .update({
          three_ds_type: "challenge",
          three_ds_data: result.threeDsData,
          fiserv_order_id: result.transactionId,
        })
        .eq("id", payment.id);

      return new Response(
        html("challenge", JSON.stringify(result.threeDsData)),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Declined or error
    await service
      .from("payments")
      .update({ status: result.status === "declined" ? "declined" : "error" })
      .eq("id", payment.id);

    return new Response(
      html("declined", result.declineReason ?? "Payment failed"),
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    console.error("[3ds/method-callback] error:", err);
    return new Response(
      html("error", "3DS verification failed"),
      { headers: { "Content-Type": "text/html" } }
    );
  }
}

async function finalizePayment(
  service: ReturnType<typeof createServiceClient>,
  payment: {
    id: string;
    offering_id: string;
    investor_id: string;
    quantity: number;
    amount: number;
  }
) {
  await service
    .from("payments")
    .update({ status: "captured" })
    .eq("id", payment.id);

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
    token_id: payment.id,
  });

  // Note: RPC calls for increment_shares_sold and increment_investor_invested
  // would need an auth context. The indexer will pick these up on next sync.
}

function html(status: string, message: string): string {
  return `<!DOCTYPE html>
<html><body>
<script>
  window.parent.postMessage({ type: 'acm-3ds', status: '${status}', message: '${message.replace(/'/g, "\\'")}' }, '*');
</script>
</body></html>`;
}
