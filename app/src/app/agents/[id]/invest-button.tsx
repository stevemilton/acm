"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther } from "viem";
import { ESCROW_ABI } from "@/lib/contracts";
import { CONTRACT_ADDRESSES } from "@/lib/wagmi";

export function InvestButton({
  offeringId,
  pricePerShare,
  sharesRemaining,
  isLoggedIn,
}: {
  offeringId: string;
  pricePerShare: number;
  sharesRemaining: number;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [rail, setRail] = useState<"fiat" | "crypto">("fiat");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const router = useRouter();
  const supabase = createClient();

  // Wagmi hooks for crypto rail
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { isLoading: isTxPending } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const totalCost = quantity * pricePerShare;

  async function handleFiatInvest() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    // Get or create investor profile
    let { data: investor } = await supabase
      .from("investors")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!investor) {
      const { data: newInvestor, error: invError } = await supabase
        .from("investors")
        .insert({ user_id: user.id, kyc_status: "none" })
        .select("id")
        .single();

      if (invError) throw new Error(invError.message);
      investor = newInvestor;
    }

    // In production: create Stripe Checkout session first
    const { error: shareError } = await supabase.from("shares").insert({
      offering_id: offeringId,
      investor_id: investor!.id,
      quantity,
      purchase_price: pricePerShare,
      rail: "fiat",
    });

    if (shareError) throw new Error(shareError.message);
  }

  async function handleCryptoInvest() {
    if (!isConnected || !address) {
      throw new Error("Connect your wallet first");
    }

    const escrowAddress = CONTRACT_ADDRESSES.testnet.escrow;
    if (!escrowAddress) {
      throw new Error("Escrow contract not yet deployed");
    }

    // Call escrow.deposit() with BNB value
    // Each share costs pricePerShare in BNB equivalent on testnet
    const value = parseEther((quantity * 0.01).toString()); // 0.01 BNB per share on testnet

    const hash = await writeContractAsync({
      address: escrowAddress,
      abi: ESCROW_ABI,
      functionName: "deposit",
      value,
    });

    setTxHash(hash);

    // Also record in Supabase for tracking
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      let { data: investor } = await supabase
        .from("investors")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!investor) {
        const { data: newInvestor } = await supabase
          .from("investors")
          .insert({ user_id: user.id, kyc_status: "none" })
          .select("id")
          .single();
        investor = newInvestor;
      }

      if (investor) {
        await supabase.from("shares").insert({
          offering_id: offeringId,
          investor_id: investor.id,
          quantity,
          purchase_price: pricePerShare,
          rail: "crypto",
          token_id: hash, // tx hash as reference
        });
      }
    }
  }

  async function handleInvest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (rail === "fiat") {
        await handleFiatInvest();
      } else {
        await handleCryptoInvest();
      }
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <a
        href="/login"
        className="block w-full text-center py-3 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover transition-colors"
      >
        Sign in to Invest
      </a>
    );
  }

  if (success) {
    return (
      <div className="p-4 rounded-lg bg-accent/10 border border-accent/30 text-center">
        <p className="text-accent font-medium">Investment confirmed!</p>
        <p className="text-sm text-muted mt-1">
          {quantity} shares for ${totalCost.toLocaleString()}
        </p>
        {txHash && (
          <a
            href={`https://testnet.bscscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent/70 hover:underline mt-2 inline-block"
          >
            View on BSCScan &rarr;
          </a>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover transition-colors"
      >
        Invest Now
      </button>
    );
  }

  return (
    <form
      onSubmit={handleInvest}
      className="p-4 rounded-lg border border-accent/30 bg-accent/5 space-y-4"
    >
      {/* Rail selector */}
      <div>
        <label className="block text-sm font-medium mb-2">Payment Rail</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRail("fiat")}
            className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
              rail === "fiat"
                ? "border-accent bg-accent/10 text-accent"
                : "border-card-border bg-card text-muted"
            }`}
          >
            Fiat (Card)
          </button>
          <button
            type="button"
            onClick={() => setRail("crypto")}
            className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
              rail === "crypto"
                ? "border-accent bg-accent/10 text-accent"
                : "border-card-border bg-card text-muted"
            }`}
          >
            Crypto (BNB)
          </button>
        </div>
      </div>

      {/* Wallet status for crypto */}
      {rail === "crypto" && !isConnected && (
        <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-sm text-yellow-500">
          Connect your wallet in the navbar to pay with crypto
        </div>
      )}

      {rail === "crypto" && isConnected && address && (
        <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 text-sm">
          <span className="text-muted">Wallet: </span>
          <span className="font-mono text-xs">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </div>
      )}

      {/* Quantity */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Number of Shares
        </label>
        <input
          type="number"
          min={1}
          max={sharesRemaining}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-full px-3 py-2 rounded-lg bg-card border border-card-border text-foreground focus:outline-none focus:border-accent"
        />
        <p className="text-xs text-muted mt-1">
          {sharesRemaining.toLocaleString()} shares available
        </p>
      </div>

      {/* Total */}
      <div className="p-3 rounded-lg bg-card border border-card-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Total Cost</span>
          <span className="text-lg font-bold">
            {rail === "fiat" ? (
              <>${totalCost.toLocaleString()}</>
            ) : (
              <>
                {(quantity * 0.01).toFixed(4)}{" "}
                <span className="text-xs text-muted">BNB</span>
              </>
            )}
          </span>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {isTxPending && (
        <p className="text-accent text-sm">
          Transaction pending... waiting for confirmation
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || isTxPending || (rail === "crypto" && !isConnected)}
          className="flex-1 py-2.5 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 text-sm"
        >
          {loading || isTxPending
            ? "Processing..."
            : rail === "fiat"
              ? "Pay with Card"
              : "Pay with BNB"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2.5 rounded-lg border border-card-border text-muted hover:text-foreground transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
