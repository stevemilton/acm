import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const role = user.user_metadata?.role ?? "investor";

  // Get investor profile and holdings
  const { data: investor } = await supabase
    .from("investors")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // Get shares with offering and agent details
  const { data: shares } = investor
    ? await supabase
        .from("shares")
        .select("*, offerings(*, agents(name, monthly_revenue, status))")
        .eq("investor_id", investor.id)
        .order("purchased_at", { ascending: false })
    : { data: null };

  // Calculate portfolio stats
  const totalInvested =
    shares?.reduce((sum, s) => sum + s.quantity * Number(s.purchase_price), 0) ?? 0;
  const totalShares = shares?.reduce((sum, s) => sum + s.quantity, 0) ?? 0;

  // Get distributions for agents the user has invested in
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted mt-1">
            {role === "operator"
              ? "Your portfolio and agent management"
              : "Your portfolio and distributions"}
          </p>
        </div>
        {role === "operator" && (
          <Link
            href="/operator"
            className="px-4 py-2 rounded-lg border border-card-border text-sm text-muted hover:text-foreground transition-colors"
          >
            Manage Agents
          </Link>
        )}
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
        {shares?.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-muted">
                <th className="text-left px-6 py-3 font-medium">Agent</th>
                <th className="text-right px-6 py-3 font-medium">Shares</th>
                <th className="text-right px-6 py-3 font-medium">
                  Cost Basis
                </th>
                <th className="text-right px-6 py-3 font-medium">
                  Rev Share %
                </th>
                <th className="text-right px-6 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {shares.map((share) => {
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
                        : "—"}
                    </td>
                    <td className="px-6 py-3 text-right text-muted">
                      {new Date(share.purchased_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center text-muted text-sm">
            <p className="mb-3">No holdings yet</p>
            <Link href="/offerings" className="text-accent hover:underline">
              Browse offerings
            </Link>
          </div>
        )}
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
