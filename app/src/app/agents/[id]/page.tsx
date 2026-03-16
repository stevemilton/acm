import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { InvestButton } from "./invest-button";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getUser();

  const { data: agent } = await supabase
    .from("agents")
    .select("*, operators(wallet_address)")
    .eq("id", id)
    .single();

  if (!agent) notFound();

  const { data: offerings } = await supabase
    .from("offerings")
    .select("*")
    .eq("agent_id", agent.id)
    .in("escrow_status", ["pending", "funded"])
    .order("created_at", { ascending: false });

  const { data: distributions } = await supabase
    .from("distributions")
    .select("*")
    .eq("agent_id", agent.id)
    .order("period_end", { ascending: false })
    .limit(12);

  // Calculate totals
  const totalDistributed =
    distributions?.reduce(
      (sum, d) => sum + Number(d.investor_amount),
      0
    ) ?? 0;
  const totalGrossRevenue =
    distributions?.reduce(
      (sum, d) => sum + Number(d.gross_revenue),
      0
    ) ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Agent header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold">{agent.name}</h1>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${
                agent.status === "listed"
                  ? "bg-blue-500/10 text-blue-500"
                  : agent.status === "verified"
                    ? "bg-accent/10 text-accent"
                    : "bg-yellow-500/10 text-yellow-500"
              }`}
            >
              {agent.status}
            </span>
          </div>
          <p className="text-muted">{agent.category}</p>
        </div>
      </div>

      <p className="text-muted mb-8 max-w-2xl">{agent.description}</p>

      {/* Key metrics */}
      <div className="grid sm:grid-cols-4 gap-4 mb-10">
        <div className="p-5 rounded-xl border border-card-border bg-card">
          <p className="text-muted text-xs">Monthly Revenue</p>
          <p className="text-xl font-bold mt-1">
            ${Number(agent.monthly_revenue).toLocaleString()}
          </p>
        </div>
        <div className="p-5 rounded-xl border border-card-border bg-card">
          <p className="text-muted text-xs">Verified Days</p>
          <p className="text-xl font-bold mt-1">{agent.verification_days}</p>
        </div>
        <div className="p-5 rounded-xl border border-card-border bg-card">
          <p className="text-muted text-xs">Total Revenue (tracked)</p>
          <p className="text-xl font-bold mt-1">
            ${totalGrossRevenue.toLocaleString()}
          </p>
        </div>
        <div className="p-5 rounded-xl border border-card-border bg-card">
          <p className="text-muted text-xs">Distributed to Investors</p>
          <p className="text-xl font-bold mt-1 text-accent">
            ${totalDistributed.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Revenue source */}
      <div className="mb-10">
        <h2 className="text-lg font-bold mb-3">Revenue Verification</h2>
        <div className="p-4 rounded-xl border border-card-border bg-card flex items-center justify-between">
          <div>
            <p className="text-sm font-medium capitalize">
              {agent.revenue_source}
            </p>
            <p className="text-xs text-muted">
              {agent.revenue_verified_at
                ? `Verified since ${new Date(agent.revenue_verified_at).toLocaleDateString()}`
                : "Verification in progress"}
            </p>
          </div>
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              agent.revenue_verified_at
                ? "bg-accent/10 text-accent"
                : "bg-yellow-500/10 text-yellow-500"
            }`}
          >
            {agent.revenue_verified_at ? "Connected" : "Pending"}
          </span>
        </div>
      </div>

      {/* Active offerings */}
      <div className="mb-10">
        <h2 className="text-lg font-bold mb-3">Active Offerings</h2>
        {offerings?.length ? (
          <div className="space-y-4">
            {offerings.map((offering) => {
              const raised =
                offering.shares_sold * Number(offering.price_per_share);
              const progress =
                (raised / Number(offering.max_raise)) * 100;
              const sharesRemaining =
                offering.total_shares - offering.shares_sold;
              const endsAt = new Date(offering.ends_at);
              const daysLeft = Math.max(
                0,
                Math.ceil(
                  (endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                )
              );

              return (
                <div
                  key={offering.id}
                  className="p-6 rounded-xl border border-card-border bg-card"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-semibold">
                        {Number(offering.revenue_share_pct)}% Revenue Share
                      </p>
                      <p className="text-sm text-muted">
                        ${Number(offering.price_per_share)} per share &middot;{" "}
                        {sharesRemaining.toLocaleString()} shares remaining
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {daysLeft} days left
                      </p>
                      <p className="text-xs text-muted">
                        Ends {endsAt.toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-muted mb-1">
                      <span>${raised.toLocaleString()} raised</span>
                      <span>
                        ${Number(offering.max_raise).toLocaleString()} max
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-card-border overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{
                          width: `${Math.min(progress, 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted mt-1">
                      Min raise: ${Number(offering.min_raise).toLocaleString()}
                    </p>
                  </div>

                  {/* Invest CTA */}
                  <InvestButton
                    offeringId={offering.id}
                    pricePerShare={Number(offering.price_per_share)}
                    sharesRemaining={sharesRemaining}
                    isLoggedIn={!!user}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-xl border border-card-border bg-card text-center text-muted text-sm">
            No active offerings
          </div>
        )}
      </div>

      {/* Distribution history */}
      {distributions && distributions.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3">Distribution History</h2>
          <div className="rounded-xl border border-card-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-muted">
                  <th className="text-left px-6 py-3 font-medium">Period</th>
                  <th className="text-right px-6 py-3 font-medium">
                    Gross Revenue
                  </th>
                  <th className="text-right px-6 py-3 font-medium">
                    To Investors
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
                    <td className="px-6 py-3 text-right text-accent">
                      ${Number(dist.investor_amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
