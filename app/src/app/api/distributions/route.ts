import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PLATFORM_FEE_PCT = 0.05; // 5%

/**
 * POST /api/distributions
 * Trigger a revenue distribution for an agent.
 * Called by operator or automated webhook from revenue source.
 *
 * Body: { agent_id, gross_revenue, period_start, period_end }
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { agent_id, gross_revenue, period_start, period_end } = body as {
    agent_id: string;
    gross_revenue: number;
    period_start: string;
    period_end: string;
  };

  if (!agent_id || !gross_revenue || !period_start || !period_end) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Verify caller is the agent's operator
  const { data: agent } = await supabase
    .from("agents")
    .select("*, operators(user_id)")
    .eq("id", agent_id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const operatorUserId = (agent.operators as { user_id: string } | null)
    ?.user_id;
  if (operatorUserId !== user.id) {
    return NextResponse.json(
      { error: "Only the agent operator can trigger distributions" },
      { status: 403 }
    );
  }

  // Get the active offering to determine revenue share %
  const { data: offering } = await supabase
    .from("offerings")
    .select("*")
    .eq("agent_id", agent_id)
    .in("escrow_status", ["funded", "released"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const revenueSharePct = offering
    ? Number(offering.revenue_share_pct) / 100
    : 0;

  // Calculate splits
  const platformFee = gross_revenue * PLATFORM_FEE_PCT;
  const afterFee = gross_revenue - platformFee;
  const investorAmount = afterFee * revenueSharePct;
  const operatorAmount = afterFee - investorAmount;

  // Create distribution record
  const { data: distribution, error: distError } = await supabase
    .from("distributions")
    .insert({
      agent_id,
      period_start,
      period_end,
      gross_revenue,
      platform_fee: platformFee,
      operator_amount: operatorAmount,
      investor_amount: investorAmount,
    })
    .select()
    .single();

  if (distError) {
    return NextResponse.json(
      { error: distError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    distribution,
    splits: {
      gross_revenue,
      platform_fee: platformFee,
      operator_amount: operatorAmount,
      investor_amount: investorAmount,
      revenue_share_pct: revenueSharePct * 100,
    },
  });
}
