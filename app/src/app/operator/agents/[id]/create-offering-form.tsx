"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function CreateOfferingForm({ agentId }: { agentId: string }) {
  const [open, setOpen] = useState(false);
  const [revenueSharePct, setRevenueSharePct] = useState(15);
  const [totalShares, setTotalShares] = useState(1000);
  const [pricePerShare, setPricePerShare] = useState(50);
  const [minRaise, setMinRaise] = useState(10000);
  const [durationDays, setDurationDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const maxRaise = totalShares * pricePerShare;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (minRaise > maxRaise) {
      setError("Min raise cannot exceed max raise (total shares x price)");
      setLoading(false);
      return;
    }

    const startsAt = new Date().toISOString();
    const endsAt = new Date(
      Date.now() + durationDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: offeringError } = await supabase.from("offerings").insert({
      agent_id: agentId,
      revenue_share_pct: revenueSharePct,
      total_shares: totalShares,
      price_per_share: pricePerShare,
      min_raise: minRaise,
      max_raise: maxRaise,
      escrow_status: "pending",
      starts_at: startsAt,
      ends_at: endsAt,
    });

    if (offeringError) {
      setError(offeringError.message);
      setLoading(false);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 rounded-lg border border-dashed border-accent/50 text-accent font-medium hover:bg-accent/5 transition-colors text-sm"
      >
        + Create New Offering
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-card p-6">
      <h3 className="text-lg font-semibold mb-4">Create Offering</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Revenue Share %
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={revenueSharePct}
              onChange={(e) => setRevenueSharePct(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground focus:outline-none focus:border-accent"
            />
            <p className="text-xs text-muted mt-1">
              % of net revenue going to investors (max 50%)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Total Shares
            </label>
            <input
              type="number"
              min={1}
              value={totalShares}
              onChange={(e) => setTotalShares(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Price per Share ($)
            </label>
            <input
              type="number"
              min={1}
              step={0.01}
              value={pricePerShare}
              onChange={(e) => setPricePerShare(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Minimum Raise ($)
            </label>
            <input
              type="number"
              min={1}
              value={minRaise}
              onChange={(e) => setMinRaise(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Duration (days)
            </label>
            <input
              type="number"
              min={7}
              max={90}
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-end">
            <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 w-full">
              <p className="text-xs text-muted">Max Raise</p>
              <p className="text-lg font-bold text-accent">
                ${maxRaise.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? "Creating..." : "Create Offering"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-6 py-2 rounded-lg border border-card-border text-muted hover:text-foreground transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
