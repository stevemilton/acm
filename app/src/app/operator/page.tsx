import Link from "next/link";
import { requireOperator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function OperatorPage() {
  const { operator } = await requireOperator();
  const supabase = await createClient();

  const { data: agents } = await supabase
    .from("agents")
    .select("*, offerings(*)")
    .eq("operator_id", operator.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Agents</h1>
          <p className="text-muted mt-1">Manage your AI agents and offerings</p>
        </div>
        <Link
          href="/operator/agents/new"
          className="px-4 py-2 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover transition-colors text-sm"
        >
          List New Agent
        </Link>
      </div>

      {!agents?.length ? (
        <div className="rounded-xl border border-card-border bg-card p-12 text-center">
          <p className="text-muted mb-4">No agents listed yet</p>
          <Link
            href="/operator/agents/new"
            className="text-accent hover:underline text-sm"
          >
            List your first agent
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/operator/agents/${agent.id}`}
              className="block p-6 rounded-xl border border-card-border bg-card hover:border-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{agent.name}</h3>
                  <p className="text-muted text-sm">{agent.category}</p>
                </div>
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
              <div className="mt-4 flex items-center gap-6 text-sm">
                <div>
                  <span className="text-muted">Monthly Revenue: </span>
                  <span className="font-medium">
                    ${Number(agent.monthly_revenue).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted">Verified: </span>
                  <span className="font-medium">
                    {agent.verification_days} days
                  </span>
                </div>
                <div>
                  <span className="text-muted">Offerings: </span>
                  <span className="font-medium">
                    {(agent.offerings as unknown[])?.length ?? 0}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
