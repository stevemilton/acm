import { requireOperator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CreateOfferingForm } from "./create-offering-form";
import {
  OnboardingChecklist,
  type ChecklistStep,
} from "@/components/ui/onboarding-checklist";

const TIER_BADGES: Record<string, { label: string; className: string }> = {
  pre_revenue: {
    label: "Pre-Revenue",
    className: "bg-purple-500/10 text-purple-400",
  },
  early_revenue: {
    label: "Early Revenue",
    className: "bg-yellow-500/10 text-yellow-500",
  },
  verified: {
    label: "Verified",
    className: "bg-accent/10 text-accent",
  },
};

export default async function OperatorAgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { operator } = await requireOperator();
  const supabase = await createClient();

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .eq("operator_id", operator.id)
    .single();

  if (!agent) notFound();

  const tier = agent.revenue_tier ?? "pre_revenue";
  const tierBadge = TIER_BADGES[tier] ?? TIER_BADGES.pre_revenue;
  const isPreRevenue = tier === "pre_revenue";
  const isPending = agent.status === "pending";

  const { data: offerings } = await supabase
    .from("offerings")
    .select("*")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false });

  const { data: distributions } = await supabase
    .from("distributions")
    .select("*")
    .eq("agent_id", agent.id)
    .order("period_end", { ascending: false })
    .limit(10);

  const canCreateOffering =
    agent.status === "verified" || agent.status === "listed";

  const hasRevenueSource = !!agent.revenue_source;
  const hasVerification = (agent.verification_days ?? 0) >= 30;
  const hasOffering = !!offerings?.length;
  const hasDeployedContract = offerings?.some(
    (o) => o.escrow_status === "funded" || o.escrow_status === "released"
  );

  const pipelineSteps: ChecklistStep[] = [
    {
      label: "Connect revenue source",
      description: "Link your agent's revenue stream for verification",
      complete: hasRevenueSource,
    },
    {
      label: "Complete 30-day verification",
      description: `${agent.verification_days ?? 0}/30 days verified`,
      complete: hasVerification,
    },
    {
      label: "Create an offering",
      description: "Set terms for investors to purchase revenue share tokens",
      complete: hasOffering,
    },
    {
      label: "Deploy contracts",
      description: "Deploy on-chain escrow and token contracts",
      complete: !!hasDeployedContract,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link
            href="/operator"
            className="text-muted text-sm hover:text-foreground mb-2 inline-block"
          >
            &larr; My Agents
          </Link>
          <h1 className="text-3xl font-bold">{agent.name}</h1>
          <p className="text-muted mt-1">{agent.category}</p>
        </div>
        <span
          className={`text-xs font-medium px-3 py-1.5 rounded-full ${tierBadge.className}`}
        >
          {tierBadge.label}
        </span>
      </div>

      {/* Metrics */}
      <div className="grid sm:grid-cols-3 gap-6 mb-8">
        {isPreRevenue ? (
          <>
            <div className="p-6 rounded-xl border border-card-border bg-card">
              <p className="text-muted text-sm">Active Users</p>
              <p className="text-2xl font-bold mt-1">
                {(agent.active_users ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="p-6 rounded-xl border border-card-border bg-card">
              <p className="text-muted text-sm">Stage</p>
              <p className="text-2xl font-bold mt-1">Pre-Revenue</p>
            </div>
            <div className="p-6 rounded-xl border border-card-border bg-card">
              <p className="text-muted text-sm">Status</p>
              <p className="text-lg font-semibold mt-1 capitalize">
                {agent.status}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="p-6 rounded-xl border border-card-border bg-card">
              <p className="text-muted text-sm">Monthly Revenue</p>
              <p className="text-2xl font-bold mt-1">
                ${Number(agent.monthly_revenue).toLocaleString()}
              </p>
            </div>
            <div className="p-6 rounded-xl border border-card-border bg-card">
              <p className="text-muted text-sm">Verification Days</p>
              <p className="text-2xl font-bold mt-1">
                {agent.verification_days}
              </p>
              {agent.verification_days < 30 && (
                <p className="text-yellow-500 text-xs mt-1">
                  {30 - agent.verification_days} more days needed
                </p>
              )}
            </div>
            <div className="p-6 rounded-xl border border-card-border bg-card">
              <p className="text-muted text-sm">Revenue Source</p>
              <p className="text-lg font-semibold mt-1 capitalize">
                {agent.revenue_source}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Pending: show pipeline steps instead of yellow banner */}
      {isPending && (
        <div className="mb-8">
          <OnboardingChecklist steps={pipelineSteps} title="Pipeline" />
        </div>
      )}

      {/* Offerings section — hide when pending */}
      {!isPending && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Offerings</h2>
          </div>

          {offerings?.length ? (
            <div className="space-y-4">
              {offerings.map((offering) => {
                const raised =
                  offering.shares_sold * Number(offering.price_per_share);
                const progress =
                  (raised / Number(offering.max_raise)) * 100;

                return (
                  <div
                    key={offering.id}
                    className="p-6 rounded-xl border border-card-border bg-card"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm">
                        <span className="font-semibold">
                          {Number(offering.revenue_share_pct)}% revenue share
                        </span>
                        <span className="text-muted">
                          {" "}
                          &middot; ${Number(offering.price_per_share)}/share
                        </span>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          offering.escrow_status === "funded"
                            ? "bg-accent/10 text-accent"
                            : offering.escrow_status === "released"
                              ? "bg-blue-500/10 text-blue-500"
                              : "bg-yellow-500/10 text-yellow-500"
                        }`}
                      >
                        {offering.escrow_status}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-card-border overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{
                          width: `${Math.min(progress, 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>
                        ${raised.toLocaleString()} / $
                        {Number(offering.max_raise).toLocaleString()}
                      </span>
                      <span>
                        {offering.shares_sold}/{offering.total_shares} shares
                        sold
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : canCreateOffering ? (
            <div className="rounded-xl border border-dashed border-card-border bg-card/50 p-8 text-center">
              <p className="text-muted text-sm mb-2">No offerings yet</p>
              <p className="text-muted text-xs">
                Create your first offering below
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-card-border bg-card p-8 text-center">
              <p className="text-muted text-sm">
                Your listing needs to be approved before you can create an
                offering
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create offering form — hide when pending */}
      {!isPending && canCreateOffering && (
        <CreateOfferingForm agentId={agent.id} />
      )}

      {/* Distributions history — hide when pending */}
      {!isPending && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Distribution History</h2>
          <div className="rounded-xl border border-card-border bg-card overflow-hidden">
            {distributions?.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-muted">
                    <th className="text-left px-6 py-3 font-medium">Period</th>
                    <th className="text-right px-6 py-3 font-medium">Gross</th>
                    <th className="text-right px-6 py-3 font-medium">
                      Platform Fee
                    </th>
                    <th className="text-right px-6 py-3 font-medium">
                      Your Share
                    </th>
                    <th className="text-right px-6 py-3 font-medium">
                      Investors
                    </th>
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
                      <td className="px-6 py-3 text-right text-muted">
                        ${Number(dist.platform_fee).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right">
                        ${Number(dist.operator_amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right text-accent">
                        ${Number(dist.investor_amount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-muted text-sm">
                No distributions yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
