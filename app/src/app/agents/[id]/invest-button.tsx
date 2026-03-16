"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { ESCROW_ABI, ERC20_ABI } from "@/lib/contracts";
import { getFdusdAddress, getExplorerUrl } from "@/lib/chain-config";

export function InvestButton({
  offeringId,
  pricePerShare,
  sharesRemaining,
  isLoggedIn,
  escrowAddress: escrowAddressProp,
}: {
  offeringId: string;
  pricePerShare: number;
  sharesRemaining: number;
  isLoggedIn: boolean;
  escrowAddress?: string;
}) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [rail, setRail] = useState<"fiat" | "crypto">("fiat");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [step, setStep] = useState<"idle" | "approving" | "depositing">("idle");
  const router = useRouter();
  const supabase = createClient();

  // Wagmi hooks for crypto rail
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { isLoading: isTxPending } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const escrowAddress = escrowAddressProp
    ? (escrowAddressProp as `0x${string}`)
    : undefined;
  const fdusdAddress = getFdusdAddress();

  // Total cost in FDUSD (18 decimals)
  const totalCostNumber = quantity * pricePerShare;
  const totalCostUnits = parseUnits(totalCostNumber.toString(), 18);

  // Read FDUSD balance
  const { data: fdusdBalance } = useReadContract({
    address: fdusdAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && rail === "crypto" },
  });

  // Read FDUSD allowance for escrow
  const { data: fdusdAllowance, refetch: refetchAllowance } = useReadContract({
    address: fdusdAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && escrowAddress ? [address, escrowAddress] : undefined,
    query: { enabled: !!address && !!escrowAddress && rail === "crypto" },
  });

  const formattedBalance = fdusdBalance
    ? formatUnits(fdusdBalance, 18)
    : "0";

  const needsApproval =
    fdusdAllowance !== undefined && fdusdAllowance < totalCostUnits;

  const insufficientBalance =
    fdusdBalance !== undefined && fdusdBalance < totalCostUnits;

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

    if (!escrowAddress) {
      throw new Error("Crypto investment not available for this offering");
    }

    if (insufficientBalance) {
      throw new Error(
        `Insufficient FDUSD balance. You have ${Number(formattedBalance).toLocaleString()} FDUSD but need ${totalCostNumber.toLocaleString()} FDUSD.`
      );
    }

    // Step 1: Approve FDUSD spending if needed
    if (needsApproval) {
      setStep("approving");
      const approveHash = await writeContractAsync({
        address: fdusdAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [escrowAddress, totalCostUnits],
      });

      // Wait for approval tx to be mined
      setTxHash(approveHash);
      // Brief wait for approval to propagate, then refetch allowance
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await refetchAllowance();
    }

    // Step 2: Deposit into escrow (ERC-20 transferFrom, no value)
    setStep("depositing");
    const depositHash = await writeContractAsync({
      address: escrowAddress,
      abi: ESCROW_ABI,
      functionName: "deposit",
      args: [totalCostUnits],
    });

    setTxHash(depositHash);

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
          token_id: depositHash, // tx hash as reference
        });
      }
    }
  }

  async function handleInvest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setStep("idle");

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
      setStep("idle");
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
          {quantity} shares for {totalCostNumber.toLocaleString()} FDUSD
        </p>
        {txHash && (
          <a
            href={getExplorerUrl("tx", txHash)}
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
            Crypto (FDUSD)
          </button>
        </div>
      </div>

      {/* No escrow address for crypto */}
      {rail === "crypto" && !escrowAddress && (
        <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-sm text-yellow-500">
          Crypto investment not available for this offering
        </div>
      )}

      {/* Wallet status for crypto */}
      {rail === "crypto" && escrowAddress && !isConnected && (
        <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-sm text-yellow-500">
          Connect your wallet in the navbar to pay with crypto
        </div>
      )}

      {rail === "crypto" && escrowAddress && isConnected && address && (
        <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 text-sm space-y-1">
          <div>
            <span className="text-muted">Wallet: </span>
            <span className="font-mono text-xs">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
          <div>
            <span className="text-muted">FDUSD Balance: </span>
            <span className={`font-medium ${insufficientBalance ? "text-red-400" : "text-accent"}`}>
              {Number(formattedBalance).toLocaleString()} FDUSD
            </span>
          </div>
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
              <>${totalCostNumber.toLocaleString()}</>
            ) : (
              <>
                {totalCostNumber.toLocaleString()}{" "}
                <span className="text-xs text-muted">FDUSD</span>
              </>
            )}
          </span>
        </div>
        {rail === "crypto" && needsApproval && (
          <p className="text-xs text-yellow-500 mt-1">
            Requires FDUSD approval before deposit
          </p>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {isTxPending && (
        <p className="text-accent text-sm">
          Transaction pending... waiting for confirmation
        </p>
      )}

      {step === "approving" && (
        <p className="text-accent text-sm">
          Step 1/2: Approving FDUSD spending...
        </p>
      )}

      {step === "depositing" && (
        <p className="text-accent text-sm">
          {needsApproval ? "Step 2/2" : "Step 1/1"}: Depositing into escrow...
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={
            loading ||
            isTxPending ||
            (rail === "crypto" && !escrowAddress) ||
            (rail === "crypto" && !isConnected) ||
            (rail === "crypto" && insufficientBalance)
          }
          className="flex-1 py-2.5 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 text-sm"
        >
          {loading || isTxPending
            ? step === "approving"
              ? "Approving FDUSD..."
              : step === "depositing"
                ? "Depositing..."
                : "Processing..."
            : rail === "fiat"
              ? "Pay with Card"
              : needsApproval
                ? "Approve & Deposit FDUSD"
                : "Deposit FDUSD"}
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
