"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits } from "viem";
import { ESCROW_ABI } from "@/lib/contracts";
import { getExplorerUrl } from "@/lib/chain-config";

const STATUS_LABELS: Record<number, string> = {
  0: "Open",
  1: "Funded",
  2: "Refunding",
};

const STATUS_COLORS: Record<number, string> = {
  0: "bg-blue-500/10 text-blue-500",
  1: "bg-accent/10 text-accent",
  2: "bg-red-500/10 text-red-400",
};

export function EscrowManage({
  escrowAddress: escrowAddressProp,
}: {
  escrowAddress?: string;
}) {
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const escrowAddress = escrowAddressProp
    ? (escrowAddressProp as `0x${string}`)
    : undefined;

  const { data: status } = useReadContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "status",
    query: { enabled: !!escrowAddress },
  });

  const { data: totalRaised } = useReadContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "totalRaised",
    query: { enabled: !!escrowAddress },
  });

  const { data: minRaise } = useReadContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "minRaise",
    query: { enabled: !!escrowAddress },
  });

  const { data: maxRaise } = useReadContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "maxRaise",
    query: { enabled: !!escrowAddress },
  });

  const { data: deadline } = useReadContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "deadline",
    query: { enabled: !!escrowAddress },
  });

  const { data: pricePerShare } = useReadContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "pricePerShare",
    query: { enabled: !!escrowAddress },
  });

  const { isLoading: isTxPending } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  if (!escrowAddress) {
    return (
      <div className="p-5 rounded-xl border border-card-border bg-card">
        <p className="text-sm text-muted">
          No escrow contract linked to this offering
        </p>
      </div>
    );
  }

  const statusNum = status !== undefined ? Number(status) : undefined;
  const statusLabel =
    statusNum !== undefined ? STATUS_LABELS[statusNum] ?? "Unknown" : "Loading...";
  const statusColor =
    statusNum !== undefined ? STATUS_COLORS[statusNum] ?? "" : "";

  const totalRaisedFormatted = totalRaised
    ? formatUnits(totalRaised, 18)
    : "0";
  const minRaiseFormatted = minRaise ? formatUnits(minRaise, 18) : "0";
  const maxRaiseFormatted = maxRaise ? formatUnits(maxRaise, 18) : "0";
  const pricePerShareFormatted = pricePerShare
    ? formatUnits(pricePerShare, 18)
    : "0";

  const progressPercent =
    totalRaised && maxRaise && maxRaise > BigInt(0)
      ? Number((totalRaised * BigInt(10000)) / maxRaise) / 100
      : 0;

  const minThresholdPercent =
    minRaise && maxRaise && maxRaise > BigInt(0)
      ? Number((minRaise * BigInt(10000)) / maxRaise) / 100
      : 0;

  const deadlineDate =
    deadline !== undefined ? new Date(Number(deadline) * 1000) : null;

  const isExpired = deadlineDate ? deadlineDate.getTime() < Date.now() : false;

  const isOpen = statusNum === 0;
  const canRelease =
    isOpen &&
    totalRaised !== undefined &&
    minRaise !== undefined &&
    totalRaised >= minRaise;
  const canTriggerRefund =
    isOpen &&
    isExpired &&
    totalRaised !== undefined &&
    minRaise !== undefined &&
    totalRaised < minRaise;

  async function handleRelease() {
    setError(null);
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: escrowAddress!,
        abi: ESCROW_ABI,
        functionName: "release",
      });
      setTxHash(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Release failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleTriggerRefund() {
    setError(null);
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: escrowAddress!,
        abi: ESCROW_ABI,
        functionName: "triggerRefund",
      });
      setTxHash(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trigger refund failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-5 rounded-xl border border-card-border bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Escrow Management</h3>
        {statusColor && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
            {statusLabel}
          </span>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-xs text-muted">Total Raised</p>
          <p className="text-sm font-medium">
            {Number(totalRaisedFormatted).toLocaleString()} FDUSD
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Price per Share</p>
          <p className="text-sm font-medium">
            {Number(pricePerShareFormatted).toLocaleString()} FDUSD
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Min Raise</p>
          <p className="text-sm font-medium">
            {Number(minRaiseFormatted).toLocaleString()} FDUSD
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Max Raise</p>
          <p className="text-sm font-medium">
            {Number(maxRaiseFormatted).toLocaleString()} FDUSD
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>{Number(totalRaisedFormatted).toLocaleString()} FDUSD raised</span>
          <span>{Number(maxRaiseFormatted).toLocaleString()} FDUSD max</span>
        </div>
        <div className="relative h-3 rounded-full bg-card-border overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
          {minThresholdPercent > 0 && minThresholdPercent < 100 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-yellow-500"
              style={{ left: `${minThresholdPercent}%` }}
              title={`Min raise: ${Number(minRaiseFormatted).toLocaleString()} FDUSD`}
            />
          )}
        </div>
        <p className="text-xs text-muted mt-1">
          Min raise: {Number(minRaiseFormatted).toLocaleString()} FDUSD
        </p>
      </div>

      {/* Deadline */}
      {deadlineDate && (
        <div className="flex items-center justify-between text-sm mb-4">
          <span className="text-muted">Deadline</span>
          <span className={isExpired ? "text-red-400" : ""}>
            {deadlineDate.toLocaleDateString()}{" "}
            {deadlineDate.toLocaleTimeString()}
            {isExpired && " (Expired)"}
          </span>
        </div>
      )}

      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

      {/* Transaction link */}
      {txHash && (
        <div className="mb-3 text-xs">
          <a
            href={getExplorerUrl("tx", txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent/70 hover:underline"
          >
            View transaction on BSCScan &rarr;
          </a>
        </div>
      )}

      {/* Action buttons */}
      {isConnected && (
        <div className="space-y-2">
          {/* Release button */}
          <div>
            <button
              onClick={handleRelease}
              disabled={!canRelease || loading || isTxPending}
              className="w-full py-2.5 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {loading || isTxPending ? "Processing..." : "Release Funds"}
            </button>
            {canRelease && (
              <p className="text-xs text-muted mt-1 text-center">
                This will send all raised FDUSD to your wallet
              </p>
            )}
          </div>

          {/* Trigger Refund button */}
          <button
            onClick={handleTriggerRefund}
            disabled={!canTriggerRefund || loading || isTxPending}
            className="w-full py-2.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            {loading || isTxPending ? "Processing..." : "Trigger Refund"}
          </button>
        </div>
      )}
    </div>
  );
}
