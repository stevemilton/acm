import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  OnboardingChecklist,
  type ChecklistStep,
} from "@/components/ui/onboarding-checklist";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const role = user.user_metadata?.role ?? "investor";

  if (role === "operator") {
    return <OperatorDashboard userId={user.id} />;
  }

  return <InvestorDashboard userId={user.id} />;
}

async function OperatorDashboard({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: operator } = await supabase
    .from("operators")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { data: agents } = operator
    ? await supabase
        .from("agents")
        .select("*, offerings(*)")
        .eq("operator_id", operator.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const hasAgents = !!agents?.length;
  const totalOfferings =
    agents?.reduce(
      (sum, a) => sum + ((a.offerings as unknown[]) ?? []).length,
      0
    ) ?? 0;
  const totalRaised =
    agents?.reduce((sum, a) => {
      const offerings = (a.offerings ?? []) as {
        shares_sold: number;
        price_per_share: string;
      }[];
      return (
        sum +
        offerings.reduce(
          (s, o) => s + o.shares_sold * Number(o.price_per_share),
          0
        )
      );
    }, 0) ?? 0;

  const hasVerifiedAgent = agents?.some(
    (a) => a.status === "verified" || a.status === "listed"
  );
  const hasOffering = totalOfferings > 0;
  const hasRevenueSource = agents?.some((a) => a.revenue_source);
  const hasVerification = agents?.some((a) => (a.verification_days ?? 0) >= 30);

  const steps: ChecklistStep[] = [
    {
      label: "Create your first agent",
      description: "List an AI agent to start the verification process",
      complete: hasAgents,
      href: "/operator/agents/new",
    },
    {
      label: "Connect a revenue source",
      description: "Link your agent's revenue stream for verification",
      complete: !!hasRevenueSource,
    },
    {
      label: "Complete 30-day verification",
      description: "Revenue must be verified over a 30-day window",
      complete: !!hasVerification,
    },
    {
      label: "Create an offering",
      description: "Set terms for investors to purchase revenue share tokens",
      complete: hasOffering,
    },
    {
      label: "Deploy contracts",
      description: "Deploy on-chain escrow and token contracts",
      complete: agents?.some((a) =>
        ((a.offerings ?? []) as { escrow_status?: string }[]).some(
          (o) => o.escrow_status === "funded" || o.escrow_status === "released"
        )
      ) ?? false,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Operator Dashboard</h1>
          <p className="text-muted mt-1">Manage your agents and offerings</p>
        </div>
        <Link
          href="/dashboard?view=investor"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          View investor portfolio &rarr;
        </Link>
      </div>

      {!hasAgents ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-8">
            <h2 className="text-xl font-bold mb-2">Welcome to ACM</h2>
            <p className="text-muted text-sm mb-6">
              List your AI agent, verify its revenue, and raise capital from
              investors through revenue share tokens.
            </p>
            <Link
              href="/operator/agents/new"
              className="inline-block px-6 py-3 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover transition-colors"
            >
              List Your First Agent
            </Link>
          </div>
          <OnboardingChecklist steps={steps} title="Getting Started" />
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid sm:grid-cols-4 gap-4 mb-8">
            <div className="p-6 rounded-xl border border-card-border bg-card">
              <p className="text-muted text-sm">Agents Listed</p>
              <p className="text-2xl font-bold mt-1">{agents.length}</p>
            </div>
            <div className="p-6 rounded-xl border border-card-border bg-card">
              <p className="text-muted text-sm">Active Offerings</p>
              <p className="text-2xl font-bold mt-1">{totalOfferings}</p>
            </div>
            <div className="p-6 rounded-xl border border-card-border bg-card">
              <p className="text-muted text-sm">Total Raised</p>
              <p className="text-2xl font-bold mt-1 text-accent">
                ${totalRaised.toLocaleString()}
              </p>
            </div>
            <div className="p-6 rounded-xl border border-card-border bg-card">
              <p className="text-muted text-sm">Status</p>
              <p className="text-2xl font-bold mt-1 capitalize">
                {hasVerifiedAgent ? "Verified" : "Pending"}
              </p>
            </div>
          </div>

          {/* Quick links */}
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <Link
              href="/operator"
              className="p-6 rounded-xl border border-card-border bg-card hover:border-accent/50 transition-colors"
            >
              <h3 className="font-semibold mb-1">Manage Agents</h3>
              <p className="text-muted text-sm">
                View and manage your listed agents
              </p>
            </Link>
            <Link
              href="/operator/agents/new"
              className="p-6 rounded-xl border border-card-border bg-card hover:border-accent/50 transition-colors"
            >
              <h3 className="font-semibold mb-1">List New Agent</h3>
              <p className="text-muted text-sm">
                Add another AI agent to the platform
              </p>
            </Link>
          </div>

          {/* Checklist if not fully complete */}
          {steps.some((s) => !s.complete) && (
            <OnboardingChecklist steps={steps} />
          )}
        </>
      )}
    </div>
  );
}

async function InvestorDashboard({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: investor } = await supabase
    .from("investors")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { data: shares } = investor
    ? await supabase
        .from("shares")
        .select("*, offerings(*, agents(name, monthly_revenue, status))")
        .eq("investor_id", investor.id)
        .order("purchased_at", { ascending: false })
    : { data: null };

  const hasHoldings = !!shares?.length;

  const totalInvested =
    shares?.reduce(
      (sum, s) => sum + s.quantity * Number(s.purchase_price),
      0
    ) ?? 0;
  const totalShares = shares?.reduce((sum, s) => sum + s.quantity, 0) ?? 0;

  const agentIds = [
    ...new Set(
      shares
        ?.map((s) => {
          const offering = s.offerings as { agent_id?: string } | null;
          return offering?.agent_id;
        })
        .filter(Boolean) ?? []
    ),
  ];

  const { data: distributions } = agentIds.length
    ? await supabase
        .from("distributions")
        .select("*")
        .in("agent_id", agentIds)
        .order("period_end", { ascending: false })
        .limit(20)
    : { data: null };

  if (!hasHoldings) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted mb-8">Your portfolio and distributions</p>

        <div className="rounded-xl border border-accent/30 bg-accent/5 p-8 mb-8">
          <h2 className="text-xl font-bold mb-2">Welcome to ACM</h2>
          <p className="text-muted text-sm mb-2">
            ACM lets you invest in AI agents by purchasing revenue share tokens.
            When agents earn revenue, you receive your proportional share
            automatically.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Link
            href="/agents"
            className="p-6 rounded-xl border border-card-border bg-card hover:border-accent/50 transition-colors"
          >
            <h3 className="font-semibold mb-1">Browse Agents</h3>
            <p className="text-muted text-sm">
              Discover AI agents raising capital
            </p>
          </Link>
          <Link
            href="/offerings"
            className="p-6 rounded-xl border border-card-border bg-card hover:border-accent/50 transition-colors"
          >
            <h3 className="font-semibold mb-1">View Offerings</h3>
            <p className="text-muted text-sm">
              See available investment opportunities
            </p>
          </Link>
          <div className="p-6 rounded-xl border border-card-border bg-card">
            <h3 className="font-semibold mb-1">Connect Wallet</h3>
            <p className="text-muted text-sm">
              Link your wallet to invest on-chain
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted mt-1">Your portfolio and distributions</p>
      </div>

      {/* Portfolio summary */}
      <div className="grid sm:grid-cols-4 gap-4 mb-10">
        <div className="p-6 rounded-xl border border-card-border bg-card">
          <p className="text-muted text-sm">Total Invested</p>
          <p className="text-2xl font-bold mt-1">
            ${totalInvested.toLocaleString()}
          </p>
        </div>
        <div className="p-6 rounded-xl border border-card-border bg-card">
          <p className="text-muted text-sm">Total Earned</p>
          <p className="text-2xl font-bold mt-1 text-accent">
            ${Number(investor?.total_earned ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="p-6 rounded-xl border border-card-border bg-card">
          <p className="text-muted text-sm">Active Shares</p>
          <p className="text-2xl font-bold mt-1">
            {totalShares.toLocaleString()}
          </p>
        </div>
        <div className="p-6 rounded-xl border border-card-border bg-card">
          <p className="text-muted text-sm">Agents Invested</p>
          <p className="text-2xl font-bold mt-1">{agentIds.length}</p>
        </div>
      </div>

      {/* Holdings */}
      <div className="rounded-xl border border-card-border bg-card overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-card-border">
          <h2 className="font-semibold">Your Holdings</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border text-muted">
              <th className="text-left px-6 py-3 font-medium">Agent</th>
              <th className="text-right px-6 py-3 font-medium">Shares</th>
              <th className="text-right px-6 py-3 font-medium">Cost Basis</th>
              <th className="text-right px-6 py-3 font-medium">Rev Share %</th>
              <th className="text-right px-6 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {shares!.map((share) => {
              const offering = share.offerings as {
                revenue_share_pct: number;
                agents?: { name: string } | null;
                agent_id: string;
              } | null;
              return (
                <tr
                  key={share.id}
                  className="border-b border-card-border last:border-0 hover:bg-card-border/20"
                >
                  <td className="px-6 py-3">
                    <Link
                      href={`/agents/${offering?.agent_id}`}
                      className="text-accent hover:underline"
                    >
                      {(offering?.agents as { name: string } | null)?.name ??
                        "Unknown"}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-right font-medium">
                    {share.quantity}
                  </td>
                  <td className="px-6 py-3 text-right">
                    $
                    {(
                      share.quantity * Number(share.purchase_price)
                    ).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {offering?.revenue_share_pct
                      ? `${Number(offering.revenue_share_pct)}%`
                      : "\u2014"}
                  </td>
                  <td className="px-6 py-3 text-right text-muted">
                    {new Date(share.purchased_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Recent distributions */}
      <div className="rounded-xl border border-card-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-card-border">
          <h2 className="font-semibold">Recent Distributions</h2>
        </div>
        {distributions?.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-muted">
                <th className="text-left px-6 py-3 font-medium">Period</th>
                <th className="text-right px-6 py-3 font-medium">
                  Gross Revenue
                </th>
                <th className="text-right px-6 py-3 font-medium">
                  Your Portion
                </th>
                <th className="text-right px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {distributions.map((dist) => (
                <tr
                  key={dist.id}
                  className="border-b border-card-border last:border-0"
                >
                  <td className="px-6 py-3">
                    {dist.period_start} — {dist.period_end}
                  </td>
                  <td className="px-6 py-3 text-right">
                    ${Number(dist.gross_revenue).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-right text-accent">
                    ${Number(dist.investor_amount).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        dist.distributed_at
                          ? "bg-accent/10 text-accent"
                          : "bg-yellow-500/10 text-yellow-500"
                      }`}
                    >
                      {dist.distributed_at ? "Paid" : "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center text-muted text-sm">
            No distributions yet
          </div>
        )}
      </div>
    </div>
  );
}
