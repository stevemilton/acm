"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import {
  ERC20_ABI,
  REVENUE_DISTRIBUTOR_ABI,
  AGENT_SHARE_ABI,
} from "@/lib/contracts";
import { getExplorerUrl } from "@/lib/chain-config";

export function DistributeRevenue({
  distributorAddress: distributorAddressProp,
  fdusdAddress: fdusdAddressProp,
}: {
  distributorAddress?: string;
  fdusdAddress?: string;
}) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [grossInput, setGrossInput] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"input" | "approve" | "distribute">("input");

  const distributorAddress = distributorAddressProp
    ? (distributorAddressProp as `0x${string}`)
    : undefined;
  const fdusdAddress = fdusdAddressProp
    ? (fdusdAddressProp as `0x${string}`)
    : undefined;

  // Read FDUSD balance
  const { data: fdusdBalance } = useReadContract({
    address: fdusdAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!fdusdAddress },
  });

  // Read current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: fdusdAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      address && distributorAddress ? [address, distributorAddress] : undefined,
    query: { enabled: !!address && !!fdusdAddress && !!distributorAddress },
  });

  // Read revenue share BPS from share token via distributor
  // We read the shareToken address from the distributor, but since we don't have
  // that in the ABI, we'll use a default of 1500 BPS (15%) as fallback
  // For now, read shareToken from the REVENUE_DISTRIBUTOR_ABI if available
  const { data: shareTokenAddress } = useReadContract({
    address: distributorAddress,
    abi: [
      {
        inputs: [],
        name: "shareToken",
        outputs: [
          { internalType: "address", name: "", type: "address" },
        ],
        stateMutability: "view",
        type: "function",
      },
    ] as const,
    functionName: "shareToken",
    query: { enabled: !!distributorAddress },
  });

  const { data: revenueShareBps } = useReadContract({
    address: shareTokenAddress as `0x${string}` | undefined,
    abi: AGENT_SHARE_ABI,
    functionName: "revenueShareBps",
    query: { enabled: !!shareTokenAddress },
  });

  const { isLoading: isTxPending } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  if (!distributorAddress) {
    return (
      <div className="p-5 rounded-xl border border-card-border bg-card">
        <p className="text-sm text-muted">
          No distributor contract linked
        </p>
      </div>
    );
  }

  const grossAmount = grossInput
    ? (() => {
        try {
          return parseUnits(grossInput, 18);
        } catch {
          return BigInt(0);
        }
      })()
    : BigInt(0);

  const hasValidAmount = grossAmount > BigInt(0);

  // Fee breakdown
  const platformFeeBps = BigInt(500); // 5%
  const bpsDenom = BigInt(10000);
  const platformFee = (grossAmount * platformFeeBps) / bpsDenom;
  const afterFee = grossAmount - platformFee;
  const revShareBps = revenueShareBps ?? BigInt(1500);
  const investorAmount = (afterFee * revShareBps) / bpsDenom;
  const operatorAmount = afterFee - investorAmount;

  const needsApproval =
    allowance !== undefined && hasValidAmount && allowance < grossAmount;

  async function handleApprove() {
    setError(null);
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: fdusdAddress!,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [distributorAddress!, grossAmount],
      });
      setTxHash(hash);
      setStep("distribute");
      // Refetch allowance after a delay
      setTimeout(() => refetchAllowance(), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDistribute() {
    setError(null);
    setLoading(true);
    try {
      const hash = await writeContractAsync({
        address: distributorAddress!,
        abi: REVENUE_DISTRIBUTOR_ABI,
        functionName: "distribute",
        args: [grossAmount],
      });
      setTxHash(hash);
      setGrossInput("");
      setStep("input");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Distribution failed");
    } finally {
      setLoading(false);
    }
  }

  function handleProceed() {
    if (needsApproval) {
      setStep("approve");
    } else {
      setStep("distribute");
    }
  }

  return (
    <div className="p-5 rounded-xl border border-card-border bg-card">
      <h3 className="text-sm font-semibold mb-4">Distribute Revenue</h3>

      {/* FDUSD Balance */}
      {isConnected && fdusdBalance !== undefined && (
        <div className="flex items-center justify-between text-sm mb-4">
          <span className="text-muted">Your FDUSD Balance</span>
          <span className="font-medium">
            {Number(formatUnits(fdusdBalance, 18)).toLocaleString()} FDUSD
          </span>
        </div>
      )}

      {/* Gross revenue input */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">
          Gross Revenue (FDUSD)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={grossInput}
          onChange={(e) => {
            setGrossInput(e.target.value);
            setStep("input");
            setTxHash(undefined);
          }}
          placeholder="0.00"
          className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground focus:outline-none focus:border-accent"
        />
      </div>

      {/* Fee breakdown */}
      {hasValidAmount && (
        <div className="rounded-lg bg-background/50 border border-card-border p-3 mb-4 space-y-2">
          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
            Fee Breakdown
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Platform Fee (5%)</span>
            <span>{Number(formatUnits(platformFee, 18)).toLocaleString()} FDUSD</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              Operator Share ({Number(bpsDenom - revShareBps) / 100}%)
            </span>
            <span>{Number(formatUnits(operatorAmount, 18)).toLocaleString()} FDUSD</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              Investor Share ({Number(revShareBps) / 100}%)
            </span>
            <span className="text-accent">
              {Number(formatUnits(investorAmount, 18)).toLocaleString()} FDUSD
            </span>
          </div>
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
          {step === "input" && (
            <button
              onClick={handleProceed}
              disabled={!hasValidAmount || loading}
              className="w-full py-2.5 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {needsApproval ? "Continue to Approve" : "Continue to Distribute"}
            </button>
          )}

          {step === "approve" && (
            <button
              onClick={handleApprove}
              disabled={loading || isTxPending}
              className="w-full py-2.5 rounded-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-sm font-medium hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
            >
              {loading || isTxPending
                ? "Approving..."
                : `Approve ${grossInput} FDUSD`}
            </button>
          )}

          {step === "distribute" && (
            <button
              onClick={handleDistribute}
              disabled={loading || isTxPending || !hasValidAmount}
              className="w-full py-2.5 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {loading || isTxPending
                ? "Distributing..."
                : `Distribute ${grossInput} FDUSD`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
