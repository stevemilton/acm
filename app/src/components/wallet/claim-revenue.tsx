"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits } from "viem";
import {
  AGENT_SHARE_ABI,
  REVENUE_DISTRIBUTOR_ABI,
} from "@/lib/contracts";
import { getExplorerUrl } from "@/lib/chain-config";

export function ClaimRevenue({
  distributorAddress: distributorAddressProp,
  shareTokenAddress: shareTokenAddressProp,
}: {
  distributorAddress?: string;
  shareTokenAddress?: string;
}) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const agentShareAddress = shareTokenAddressProp
    ? (shareTokenAddressProp as `0x${string}`)
    : undefined;
  const distributorAddress = distributorAddressProp
    ? (distributorAddressProp as `0x${string}`)
    : undefined;

  // Read shares owned
  const { data: sharesOwned } = useReadContract({
    address: agentShareAddress,
    abi: AGENT_SHARE_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!agentShareAddress },
  });

  // Read cumulative revenue per token
  const { data: cumulativePerToken } = useReadContract({
    address: distributorAddress,
    abi: REVENUE_DISTRIBUTOR_ABI,
    functionName: "cumulativeRevenuePerToken",
    query: { enabled: !!address && !!distributorAddress },
  });

  // Read last claimed cumulative for this address
  const { data: lastClaimed } = useReadContract({
    address: distributorAddress,
    abi: REVENUE_DISTRIBUTOR_ABI,
    functionName: "lastClaimedCumulative",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!distributorAddress },
  });

  // Read pending claims
  const { data: pendingClaims, refetch: refetchPending } = useReadContract({
    address: distributorAddress,
    abi: REVENUE_DISTRIBUTOR_ABI,
    functionName: "pendingClaims",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!distributorAddress },
  });

  const { isLoading: isTxPending } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  if (!distributorAddress || !agentShareAddress) {
    return (
      <div className="p-5 rounded-xl border border-card-border bg-card">
        <p className="text-sm text-muted">On-chain claims not available</p>
      </div>
    );
  }

  if (!isConnected || !address) {
    return null;
  }

  // Calculate claimable: (cumulativePerToken - lastClaimed) * sharesOwned + pendingClaims
  // This mirrors common Solidity distribution patterns
  const unclaimedPerToken =
    cumulativePerToken !== undefined && lastClaimed !== undefined
      ? cumulativePerToken - lastClaimed
      : BigInt(0);

  const claimableFromDelta =
    sharesOwned !== undefined ? unclaimedPerToken * sharesOwned / BigInt(1e18) : BigInt(0);

  const totalClaimable =
    claimableFromDelta + (pendingClaims ?? BigInt(0));

  const hasShares = sharesOwned !== undefined && sharesOwned > BigInt(0);
  const hasClaimable = totalClaimable > BigInt(0);

  async function handleClaim() {
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const hash = await writeContractAsync({
        address: distributorAddress!,
        abi: REVENUE_DISTRIBUTOR_ABI,
        functionName: "claim",
      });

      setTxHash(hash);
      setSuccess(true);
      setTimeout(() => refetchPending(), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setLoading(false);
    }
  }

  if (!hasShares) {
    return null;
  }

  return (
    <div className="p-5 rounded-xl border border-card-border bg-card">
      <h3 className="text-sm font-semibold mb-4">On-Chain Revenue Claims</h3>

      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Shares Owned</span>
          <span className="text-sm font-medium">
            {formatUnits(sharesOwned ?? BigInt(0), 18)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Claimable Revenue</span>
          <span className="text-sm font-medium text-accent">
            {formatUnits(totalClaimable, 18)} FDUSD
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Pending Claims</span>
          <span className="text-sm font-medium">
            {formatUnits(pendingClaims ?? BigInt(0), 18)} FDUSD
          </span>
        </div>
      </div>

      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

      {success && txHash && (
        <div className="mb-3 text-xs">
          <span className="text-accent">Claim submitted! </span>
          <a
            href={getExplorerUrl("tx", txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent/70 hover:underline"
          >
            View on BSCScan &rarr;
          </a>
        </div>
      )}

      <button
        onClick={handleClaim}
        disabled={loading || isTxPending || !hasClaimable}
        className="w-full py-2.5 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {loading || isTxPending
          ? "Claiming..."
          : hasClaimable
            ? "Claim Revenue"
            : "Nothing to Claim"}
      </button>
    </div>
  );
}
