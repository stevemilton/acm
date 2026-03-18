import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

function TierBadge({ tier }: { tier: string }) {
  const badge = TIER_BADGES[tier] ?? TIER_BADGES.pre_revenue;
  return (
    <span
      className={`text-xs font-medium px-2 py-1 rounded-full ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

export default async function AgentsPage() {
  const supabase = await createClient();

  const { data: agents } = await supabase
    .from("agents")
    .select("*")
    .in("status", ["verified", "listed"])
    .order("revenue_tier", { ascending: false })
    .order("monthly_revenue", { ascending: false });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Agents</h1>
          <p className="text-muted mt-1">
            AI agents raising capital — from pre-revenue to verified performers
          </p>
        </div>
      </div>

      {agents?.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="p-6 rounded-xl border border-card-border bg-card hover:border-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{agent.name}</h3>
                  <p className="text-muted text-sm">{agent.category}</p>
                </div>
                <TierBadge tier={agent.revenue_tier ?? "pre_revenue"} />
              </div>
              <p className="text-muted text-sm mt-3 line-clamp-2">
                {agent.description}
              </p>
              <div className="mt-4 pt-4 border-t border-card-border flex items-center justify-between text-sm">
                {(agent.revenue_tier ?? "pre_revenue") === "pre_revenue" ? (
                  <>
                    <div>
                      <p className="text-muted">Active Users</p>
                      <p className="font-semibold">
                        {(agent.active_users ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted">Stage</p>
                      <p className="font-semibold">Pre-Revenue</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-muted">Monthly Revenue</p>
                      <p className="font-semibold">
                        ${Number(agent.monthly_revenue).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted">Verified</p>
                      <p className="font-semibold">
                        {agent.verification_days} days
                      </p>
                    </div>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-card-border bg-card p-16 text-center">
          <p className="text-muted text-lg mb-2">
            Agents are being verified
          </p>
          <p className="text-muted text-sm">
            New agents are going through revenue verification — check back soon
            to see available opportunities.
          </p>
        </div>
      )}
    </div>
  );
}
