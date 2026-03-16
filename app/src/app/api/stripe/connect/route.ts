import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/stripe/connect?agent_id=xxx
 * Initiates Stripe Connect onboarding for an agent operator.
 * In production, this creates a Stripe Connect account and returns the onboarding URL.
 * For now, returns a placeholder.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!agentId) {
    return NextResponse.json(
      { error: "agent_id required" },
      { status: 400 }
    );
  }

  // Verify ownership
  const { data: agent } = await supabase
    .from("agents")
    .select("*, operators(user_id)")
    .eq("id", agentId)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const operatorUserId = (agent.operators as { user_id: string } | null)
    ?.user_id;
  if (operatorUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // TODO: In production, create Stripe Connect account and return onboarding URL:
  // const account = await stripe.accounts.create({ type: 'express', ... });
  // const accountLink = await stripe.accountLinks.create({ account: account.id, ... });
  // return NextResponse.redirect(accountLink.url);

  return NextResponse.json({
    message:
      "Stripe Connect integration pending. In production, this redirects to Stripe onboarding.",
    agent_id: agentId,
  });
}
