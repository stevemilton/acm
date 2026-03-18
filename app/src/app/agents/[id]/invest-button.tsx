"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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
}: {
  offeringId: string;
  pricePerShare: number;
  sharesRemaining: number;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fiatStep, setFiatStep] = useState<FiatStep>("idle");
  const [cardInfo, setCardInfo] = useState<{
    last4: string;
    brand: string;
  } | null>(null);

  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const totalCost = quantity * pricePerShare;

  // Listen for 3DS iframe messages
  const handle3dsMessage = useCallback(
    (event: MessageEvent) => {
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

  async function handleInvest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setFiatStep("tokenizing");

    try {
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

      // Wait for the popup to close
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
        setSuccess(true);
        router.refresh();
        return;
      }

      if (authData.status === "requires_3ds") {
        setFiatStep("3ds");

        if (
          authData.threeDsType === "method" &&
          authData.threeDsData?.methodForm
        ) {
          // Render 3DS method iframe
          if (iframeRef.current) {
            const doc = iframeRef.current.contentDocument;
            if (doc) {
              doc.open();
              doc.write(authData.threeDsData.methodForm);
              doc.close();
            }
          }
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
          return;
        }

        throw new Error("Unexpected 3DS state");
      }

      // Declined or error
      throw new Error(authData.error || "Payment failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      if (fiatStep !== "3ds") {
        setLoading(false);
      }
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
        {cardInfo && (
          <p className="text-xs text-muted mt-1">
            {cardInfo.brand.toUpperCase()} ****{cardInfo.last4}
          </p>
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
            ${totalCost.toLocaleString()}
          </span>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Step indicators */}
      {fiatStep === "tokenizing" && (
        <p className="text-accent text-sm">Starting payment...</p>
      )}
      {fiatStep === "card-entry" && (
        <p className="text-accent text-sm">
          Enter your card details in the popup window...
        </p>
      )}
      {fiatStep === "authorizing" && (
        <p className="text-accent text-sm">Authorizing payment...</p>
      )}
      {fiatStep === "3ds" && (
        <p className="text-accent text-sm">
          Verifying identity (3D Secure)...
        </p>
      )}
      {fiatStep === "capturing" && (
        <p className="text-accent text-sm">Confirming payment...</p>
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
          disabled={loading}
          className="flex-1 py-2.5 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 text-sm"
        >
          {loading
            ? fiatStep === "card-entry"
              ? "Waiting for card..."
              : fiatStep === "3ds"
                ? "Verifying..."
                : "Processing..."
            : `Pay $${totalCost.toLocaleString()} with Card`}
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
