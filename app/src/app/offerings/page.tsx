import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function EscrowBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-500",
    funded: "bg-accent/10 text-accent",
    released: "bg-blue-500/10 text-blue-500",
    refunded: "bg-red-500/10 text-red-500",
  };
  return (
    <span
      className={`text-xs font-medium px-2 py-1 rounded-full ${colors[status] ?? colors.pending}`}
    >
      {status}
    </span>
  );
}

export default async function OfferingsPage() {
  const supabase = await createClient();

  const { data: offerings } = await supabase
    .from("offerings")
    .select("*, agents(id, name, category, monthly_revenue)")
    .in("escrow_status", ["pending", "funded"])
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Offerings</h1>
          <p className="text-muted mt-1">
            Active and upcoming revenue share offerings
          </p>
        </div>
      </div>

      {offerings?.length ? (
        <div className="space-y-4">
          {offerings.map((offering) => {
            const agent = offering.agents as {
              id: string;
              name: string;
              category: string;
              monthly_revenue: number;
            } | null;
            const raised =
              offering.shares_sold * Number(offering.price_per_share);
            const progress = (raised / Number(offering.max_raise)) * 100;
            const endsAt = new Date(offering.ends_at);
            const daysLeft = Math.max(
              0,
              Math.ceil(
                (endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              )
            );

            return (
              <Link
                key={offering.id}
                href={`/agents/${agent?.id}`}
                className="block p-6 rounded-xl border border-card-border bg-card hover:border-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {agent?.name ?? "Unknown Agent"}
                    </h3>
                    <p className="text-muted text-sm">
                      {Number(offering.revenue_share_pct)}% revenue share
                      &middot; ${Number(offering.price_per_share)}/share
                      &middot; {daysLeft} days left
                    </p>
                  </div>
                  <EscrowBadge status={offering.escrow_status} />
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted">
                      ${raised.toLocaleString()} raised
                    </span>
                    <span className="text-muted">
                      ${Number(offering.max_raise).toLocaleString()} max
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-card-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-muted">Shares: </span>
                    <span className="font-medium">
                      {offering.shares_sold}/{offering.total_shares}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted">Min raise: </span>
                    <span className="font-medium">
                      ${Number(offering.min_raise).toLocaleString()}
                    </span>
                  </div>
                  {agent && (
                    <div>
                      <span className="text-muted">Agent revenue: </span>
                      <span className="font-medium">
                        ${Number(agent.monthly_revenue).toLocaleString()}/mo
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-card-border bg-card p-16 text-center">
          <p className="text-muted text-lg mb-2">No active offerings</p>
          <p className="text-muted text-sm">
            Check back soon or{" "}
            <Link href="/agents" className="text-accent hover:underline">
              browse agents
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
