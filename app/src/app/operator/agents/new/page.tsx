"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  "Sales",
  "Marketing",
  "Support",
  "Data",
  "DevOps",
  "Finance",
  "Legal",
  "HR",
  "Other",
];

const TIERS = [
  {
    value: "pre_revenue",
    label: "Pre-Revenue",
    description: "No revenue yet — raising on product, traction, and team",
  },
  {
    value: "early_revenue",
    label: "Early Revenue",
    description: "Generating revenue but less than 30 days of history",
  },
  {
    value: "verified",
    label: "Verified Revenue",
    description: "30+ days of verified, consistent revenue",
  },
] as const;

export default function NewAgentPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [tier, setTier] = useState<"pre_revenue" | "early_revenue" | "verified">("pre_revenue");
  const [pitch, setPitch] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [activeUsers, setActiveUsers] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be signed in");
      setLoading(false);
      return;
    }

    // Get or create operator profile
    let { data: operator } = await supabase
      .from("operators")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!operator) {
      const { data: newOp, error: opError } = await supabase
        .from("operators")
        .insert({ user_id: user.id, kyc_status: "none" })
        .select("id")
        .single();

      if (opError) {
        setError(opError.message);
        setLoading(false);
        return;
      }
      operator = newOp;
    }

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .insert({
        name,
        description,
        category,
        operator_id: operator!.id,
        revenue_tier: tier,
        pitch,
        demo_url: demoUrl || null,
        active_users: activeUsers,
        monthly_revenue: monthlyRevenue,
        revenue_source: tier === "pre_revenue" ? "" : "manual",
        status: "pending",
        verification_days: 0,
        metadata: {},
      })
      .select("id")
      .single();

    if (agentError) {
      setError(agentError.message);
      setLoading(false);
      return;
    }

    router.push(`/operator/agents/${agent!.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold mb-2">List a New Agent</h1>
      <p className="text-muted text-sm mb-8">
        List your AI agent to raise capital from investors. Pre-revenue agents
        are welcome.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Agent Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. RevenueBot"
            className="w-full px-3 py-2 rounded-lg bg-card border border-card-border text-foreground focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium mb-1"
          >
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={3}
            placeholder="What does your agent do? What problem does it solve?"
            className="w-full px-3 py-2 rounded-lg bg-card border border-card-border text-foreground focus:outline-none focus:border-accent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  category === cat
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-card-border bg-card text-muted hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Revenue Tier */}
        <div>
          <label className="block text-sm font-medium mb-2">Stage</label>
          <div className="space-y-2">
            {TIERS.map((t) => (
              <label
                key={t.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  tier === t.value
                    ? "border-accent bg-accent/10"
                    : "border-card-border bg-card"
                }`}
              >
                <input
                  type="radio"
                  name="tier"
                  value={t.value}
                  checked={tier === t.value}
                  onChange={() => setTier(t.value)}
                  className="accent-accent mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium">{t.label}</span>
                  <p className="text-xs text-muted mt-0.5">{t.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Pitch — for all tiers, but especially important for pre-revenue */}
        <div>
          <label htmlFor="pitch" className="block text-sm font-medium mb-1">
            Investor Pitch
          </label>
          <textarea
            id="pitch"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            required
            rows={4}
            placeholder={
              tier === "pre_revenue"
                ? "Why should investors back this agent? What's the market opportunity, your traction so far, and your plan to generate revenue?"
                : "Summarize the investment opportunity — revenue trajectory, growth plans, and what the capital will be used for."
            }
            className="w-full px-3 py-2 rounded-lg bg-card border border-card-border text-foreground focus:outline-none focus:border-accent resize-none"
          />
        </div>

        {/* Demo URL */}
        <div>
          <label htmlFor="demoUrl" className="block text-sm font-medium mb-1">
            Demo / Product URL{" "}
            <span className="text-muted font-normal">(optional)</span>
          </label>
          <input
            id="demoUrl"
            type="url"
            value={demoUrl}
            onChange={(e) => setDemoUrl(e.target.value)}
            placeholder="https://your-agent.com/demo"
            className="w-full px-3 py-2 rounded-lg bg-card border border-card-border text-foreground focus:outline-none focus:border-accent"
          />
        </div>

        {/* Active Users */}
        <div>
          <label
            htmlFor="activeUsers"
            className="block text-sm font-medium mb-1"
          >
            Active Users / API Calls per Month
          </label>
          <input
            id="activeUsers"
            type="number"
            min={0}
            value={activeUsers}
            onChange={(e) => setActiveUsers(Number(e.target.value))}
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg bg-card border border-card-border text-foreground focus:outline-none focus:border-accent"
          />
          <p className="text-xs text-muted mt-1">
            Any usage metric that shows traction
          </p>
        </div>

        {/* Monthly Revenue — only show for early/verified tiers */}
        {tier !== "pre_revenue" && (
          <div>
            <label
              htmlFor="monthlyRevenue"
              className="block text-sm font-medium mb-1"
            >
              Monthly Revenue (USD)
            </label>
            <input
              id="monthlyRevenue"
              type="number"
              min={0}
              step={1}
              value={monthlyRevenue}
              onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg bg-card border border-card-border text-foreground focus:outline-none focus:border-accent"
            />
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {loading ? "Creating..." : "List Agent"}
        </button>
      </form>
    </div>
  );
}
