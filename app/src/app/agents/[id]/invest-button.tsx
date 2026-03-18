"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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

type FiatStep =
  | "idle"
  | "tokenizing"
  | "card-entry"
  | "authorizing"
  | "3ds"
  | "capturing"
  | "complete";

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
  const [cryptoStep, setCryptoStep] = useState<
    "idle" | "approving" | "depositing"
  >("idle");
  const [fiatStep, setFiatStep] = useState<FiatStep>("idle");
  const [cardInfo, setCardInfo] = useState<{
    last4: string;
    brand: string;
  } | null>(null);

  const router = useRouter();
  const supabase = createClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cardWindowRef = useRef<Window | null>(null);

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
  const { data: fdusdAllowance, refetch: refetchAllowance } =
    useReadContract({
      address: fdusdAddress,
      abi: ERC20_ABI,
      functionName: "allowance",
      args:
        address && escrowAddress ? [address, escrowAddress] : undefined,
      query: {
        enabled: !!address && !!escrowAddress && rail === "crypto",
      },
    });

  const formattedBalance = fdusdBalance
    ? formatUnits(fdusdBalance, 18)
    : "0";
  const needsApproval =
    fdusdAllowance !== undefined && fdusdAllowance < totalCostUnits;
  const insufficientBalance =
    fdusdBalance !== undefined && fdusdBalance < totalCostUnits;

  // Listen for 3DS iframe messages
  const handle3dsMessage = useCallback(
    async (event: MessageEvent) => {
      if (event.data?.type !== "acm-3ds") return;

      const { status } = event.data;
      if (status === "captured") {
        setFiatStep("complete");
        setSuccess(true);
        setLoading(false);
        router.refresh();
      } else if (status === "challenge") {
        setFiatStep("3ds");
      } else {
        setError(event.data.message || "Payment failed");
        setFiatStep("idle");
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    window.addEventListener("message", handle3dsMessage);
    return () => window.removeEventListener("message", handle3dsMessage);
  }, [handle3dsMessage]);

  // ── Fiat (Card) Flow ──────────────────────────────────

  async function handleFiatInvest() {
    setFiatStep("tokenizing");

    // Step 1: Initiate tokenization
    const tokenizeRes = await fetch("/api/payments/tokenize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offeringId, quantity }),
    });

    if (!tokenizeRes.ok) {
      const err = await tokenizeRes.json();
      throw new Error(err.error || "Failed to start payment");
    }

    const { paymentId, setupUrl, sessionId } = await tokenizeRes.json();

    // Step 2: Open Fiserv hosted card entry page
    setFiatStep("card-entry");
    const cardWindow = window.open(
      setupUrl,
      "acm-card-entry",
      "width=500,height=600,scrollbars=yes"
    );
    cardWindowRef.current = cardWindow;

    // Wait for the popup to close (user completed card entry)
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (!cardWindow || cardWindow.closed) {
          clearInterval(interval);
          resolve();
        }
      }, 500);
    });

    // Step 3: Authorize payment
    setFiatStep("authorizing");
    const authRes = await fetch("/api/payments/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, sessionId }),
    });

    const authData = await authRes.json();

    if (authData.status === "captured") {
      setFiatStep("complete");
      return;
    }

    if (authData.status === "requires_3ds") {
      setFiatStep("3ds");

      if (authData.threeDsType === "method" && authData.threeDsData?.methodForm) {
        // Render 3DS method iframe
        if (iframeRef.current) {
          const doc = iframeRef.current.contentDocument;
          if (doc) {
            doc.open();
            doc.write(authData.threeDsData.methodForm);
            doc.close();
          }
        }
        // The method-callback route will postMessage back to us
        return;
      }

      if (
        authData.threeDsType === "challenge" &&
        authData.threeDsData?.challengeUrl
      ) {
        // Open 3DS challenge in popup
        window.open(
          authData.threeDsData.challengeUrl,
          "acm-3ds-challenge",
          "width=500,height=600,scrollbars=yes"
        );
        // The challenge-callback route will redirect back
        return;
      }

      throw new Error("Unexpected 3DS state");
    }

    // Declined or error
    throw new Error(authData.error || "Payment failed");
  }

  // ── Crypto Flow ───────────────────────────────────────

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
      setCryptoStep("approving");
      const approveHash = await writeContractAsync({
        address: fdusdAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [escrowAddress, totalCostUnits],
      });
      setTxHash(approveHash);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await refetchAllowance();
    }

    // Step 2: Deposit into escrow
    setCryptoStep("depositing");
    const depositHash = await writeContractAsync({
      address: escrowAddress,
      abi: ESCROW_ABI,
      functionName: "deposit",
      args: [totalCostUnits],
    });
    setTxHash(depositHash);

    // Record in Supabase
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
          token_id: depositHash,
        });
      }
    }
  }

  // ── Submit Handler ────────────────────────────────────

  async function handleInvest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setCryptoStep("idle");
    setFiatStep("idle");

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
      if (fiatStep !== "3ds") {
        setLoading(false);
        setCryptoStep("idle");
      }
    }
  }

  // ── Render ────────────────────────────────────────────

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
          {quantity} shares for{" "}
          {rail === "fiat"
            ? `$${totalCostNumber.toLocaleString()}`
            : `${totalCostNumber.toLocaleString()} FDUSD`}
        </p>
        {cardInfo && (
          <p className="text-xs text-muted mt-1">
            {cardInfo.brand.toUpperCase()} ****{cardInfo.last4}
          </p>
        )}
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
        <label className="block text-sm font-medium mb-2">
          Payment Method
        </label>
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
            Card (USD)
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

      {/* Crypto warnings */}
      {rail === "crypto" && !escrowAddress && (
        <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-sm text-yellow-500">
          Crypto investment not available for this offering
        </div>
      )}

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
            <span
              className={`font-medium ${insufficientBalance ? "text-red-400" : "text-accent"}`}
            >
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

      {/* Fiat step indicators */}
      {rail === "fiat" && fiatStep === "tokenizing" && (
        <p className="text-accent text-sm">Starting payment...</p>
      )}
      {rail === "fiat" && fiatStep === "card-entry" && (
        <p className="text-accent text-sm">
          Enter your card details in the popup window...
        </p>
      )}
      {rail === "fiat" && fiatStep === "authorizing" && (
        <p className="text-accent text-sm">Authorizing payment...</p>
      )}
      {rail === "fiat" && fiatStep === "3ds" && (
        <p className="text-accent text-sm">
          Verifying identity (3D Secure)...
        </p>
      )}
      {rail === "fiat" && fiatStep === "capturing" && (
        <p className="text-accent text-sm">Confirming payment...</p>
      )}

      {/* Crypto step indicators */}
      {rail === "crypto" && isTxPending && (
        <p className="text-accent text-sm">
          Transaction pending... waiting for confirmation
        </p>
      )}
      {rail === "crypto" && cryptoStep === "approving" && (
        <p className="text-accent text-sm">
          Step 1/2: Approving FDUSD spending...
        </p>
      )}
      {rail === "crypto" && cryptoStep === "depositing" && (
        <p className="text-accent text-sm">
          {needsApproval ? "Step 2/2" : "Step 1/1"}: Depositing into
          escrow...
        </p>
      )}

      {/* Hidden 3DS iframe */}
      <iframe
        ref={iframeRef}
        style={{ display: "none", width: 0, height: 0 }}
        title="3DS Method"
      />

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
            ? rail === "fiat"
              ? fiatStep === "card-entry"
                ? "Waiting for card..."
                : fiatStep === "3ds"
                  ? "Verifying..."
                  : "Processing..."
              : cryptoStep === "approving"
                ? "Approving FDUSD..."
                : cryptoStep === "depositing"
                  ? "Depositing..."
                  : "Processing..."
            : rail === "fiat"
              ? `Pay $${totalCostNumber.toLocaleString()} with Card`
              : needsApproval
                ? "Approve & Deposit FDUSD"
                : "Deposit FDUSD"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setFiatStep("idle");
          }}
          className="px-4 py-2.5 rounded-lg border border-card-border text-muted hover:text-foreground transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
