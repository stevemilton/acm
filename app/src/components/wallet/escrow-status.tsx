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

export function EscrowStatus({ escrowAddress: escrowAddressProp }: { escrowAddress?: string }) {
  const { address, isConnected } = useAccount();
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

  const { isLoading: isTxPending } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  if (!escrowAddress) {
    return (
      <div className="p-5 rounded-xl border border-card-border bg-card">
        <p className="text-sm text-muted">No on-chain escrow for this offering</p>
      </div>
    );
  }

  const statusNum = status !== undefined ? Number(status) : undefined;
  const statusLabel = statusNum !== undefined ? STATUS_LABELS[statusNum] ?? "Unknown" : "Loading...";
  const statusColor = statusNum !== undefined ? STATUS_COLORS[statusNum] ?? "" : "";

  const totalRaisedFormatted = totalRaised ? formatUnits(totalRaised, 18) : "0";
  const minRaiseFormatted = minRaise ? formatUnits(minRaise, 18) : "0";
  const maxRaiseFormatted = maxRaise ? formatUnits(maxRaise, 18) : "0";

  // Progress as percentage of maxRaise
  const progressPercent =
    totalRaised && maxRaise && maxRaise > BigInt(0)
      ? Number((totalRaised * BigInt(10000)) / maxRaise) / 100
      : 0;

  // Min raise threshold as percentage of maxRaise
  const minThresholdPercent =
    minRaise && maxRaise && maxRaise > BigInt(0)
      ? Number((minRaise * BigInt(10000)) / maxRaise) / 100
      : 0;

  const deadlineDate =
    deadline !== undefined
      ? new Date(Number(deadline) * 1000)
      : null;

  const isExpired = deadlineDate ? deadlineDate.getTime() < Date.now() : false;
  const isRefunding = statusNum === 2;

  async function handleClaimRefund() {
    setError(null);
    setLoading(true);

    try {
      const hash = await writeContractAsync({
        address: escrowAddress!,
        abi: ESCROW_ABI,
        functionName: "claimRefund",
      });

      setTxHash(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refund claim failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-5 rounded-xl border border-card-border bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Escrow Status (On-Chain)</h3>
        {statusColor && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
            {statusLabel}
          </span>
        )}
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
          {/* Min raise marker */}
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

      {/* Details */}
      <div className="space-y-2 text-sm">
        {deadlineDate && (
          <div className="flex items-center justify-between">
            <span className="text-muted">Deadline</span>
            <span className={isExpired ? "text-red-400" : ""}>
              {deadlineDate.toLocaleDateString()}{" "}
              {deadlineDate.toLocaleTimeString()}
              {isExpired && " (Expired)"}
            </span>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

      {/* Refund button */}
      {isRefunding && isConnected && address && (
        <div className="mt-4">
          {txHash && (
            <div className="mb-2 text-xs">
              <a
                href={getExplorerUrl("tx", txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent/70 hover:underline"
              >
                View refund tx on BSCScan &rarr;
              </a>
            </div>
          )}
          <button
            onClick={handleClaimRefund}
            disabled={loading || isTxPending}
            className="w-full py-2.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            {loading || isTxPending ? "Processing..." : "Claim Refund"}
          </button>
        </div>
      )}
    </div>
  );
}
