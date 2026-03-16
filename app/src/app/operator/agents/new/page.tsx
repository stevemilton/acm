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

const REVENUE_SOURCES = [
  { value: "stripe", label: "Stripe Connect" },
  { value: "x402", label: "x402 (Coinbase)" },
  { value: "onchain", label: "On-chain wallet" },
  { value: "manual", label: "Manual verification" },
];

export default function NewAgentPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [revenueSource, setRevenueSource] = useState("stripe");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Get current user and their operator profile
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

    // Create agent
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .insert({
        name,
        description,
        category,
        operator_id: operator!.id,
        revenue_source: revenueSource,
        status: "pending",
        monthly_revenue: 0,
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
        Your agent will need 30+ days of verified revenue before it can accept
        investment.
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
            rows={4}
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

        <div>
          <label className="block text-sm font-medium mb-2">
            Revenue Source
          </label>
          <div className="space-y-2">
            {REVENUE_SOURCES.map((source) => (
              <label
                key={source.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  revenueSource === source.value
                    ? "border-accent bg-accent/10"
                    : "border-card-border bg-card"
                }`}
              >
                <input
                  type="radio"
                  name="revenueSource"
                  value={source.value}
                  checked={revenueSource === source.value}
                  onChange={(e) => setRevenueSource(e.target.value)}
                  className="accent-accent"
                />
                <span className="text-sm">{source.label}</span>
              </label>
            ))}
          </div>
        </div>

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
