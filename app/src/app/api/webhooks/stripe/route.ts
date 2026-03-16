import { NextResponse } from "next/server";

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhooks for:
 * - Revenue verification (payment_intent.succeeded on Connect accounts)
 * - Checkout completion (for fiat share purchases)
 * - Connect account updates
 */
export async function POST(request: Request) {
  const body = await request.text();

  // TODO: In production:
  // 1. Verify webhook signature with stripe.webhooks.constructEvent()
  // 2. Handle event types:
  //    - payment_intent.succeeded: Update agent revenue tracking
  //    - checkout.session.completed: Finalize share purchase
  //    - account.updated: Update operator Stripe Connect status
  // 3. Update verification_days and monthly_revenue on agents table

  // Placeholder acknowledgment
  void body;
  return NextResponse.json({ received: true });
}
