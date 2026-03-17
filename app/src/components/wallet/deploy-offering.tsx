"use client";

import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, decodeEventLog } from "viem";
import {
  OFFERING_FACTORY_ABI,
  OFFERING_FACTORY_EVENTS_ABI,
} from "@/lib/contracts";
import { getContractAddress } from "@/lib/chain-config";

interface DeployOfferingProps {
  offeringId: string;
  agentId: string;
  agentName: string;
  revenueSharePct: number;
  totalShares: number;
  pricePerShare: number;
  minRaise: number;
  maxRaise: number;
  durationDays: number;
}

export function DeployOffering({
  offeringId,
  agentId,
  agentName,
  revenueSharePct,
  totalShares,
  pricePerShare,
  minRaise,
  maxRaise,
  durationDays,
}: DeployOfferingProps) {
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deployed, setDeployed] = useState(false);

  const factoryAddress = getContractAddress("offeringFactory");

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { data: receipt, isLoading: isConfirming } =
    useWaitForTransactionReceipt({ hash: txHash });

  // Generate token symbol from agent name (first letters, max 5 chars)
  const symbol =
    agentName
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 5) + "S";

  const tokenName = `${agentName} Shares`;

  async function handleDeploy() {
    if (!address) return;
    setError("");
    setStatus("Sending transaction to factory...");

    const deadline = BigInt(
      Math.floor(Date.now() / 1000) + durationDays * 24 * 60 * 60
    );

    try {
      writeContract({
        address: factoryAddress,
        abi: OFFERING_FACTORY_ABI,
        functionName: "createOffering",
        args: [
          agentId,
          tokenName,
          symbol,
          BigInt(revenueSharePct * 100), // bps
          parseEther(String(totalShares)),
          parseEther(String(minRaise)),
          parseEther(String(maxRaise)),
          parseEther(String(pricePerShare)),
          deadline,
          address,
        ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setStatus("");
    }
  }

  // Process receipt when it arrives
  if (receipt && !deployed && !saving) {
    setSaving(true);
    setStatus("Transaction confirmed. Saving contract addresses...");

    // Parse OfferingCreated event from logs
    const createdEvent = receipt.logs
      .map((log) => {
        try {
          return decodeEventLog({
            abi: OFFERING_FACTORY_EVENTS_ABI,
            data: log.data,
            topics: log.topics,
          });
        } catch {
          return null;
        }
      })
      .find((e) => e?.eventName === "OfferingCreated");

    if (createdEvent && createdEvent.eventName === "OfferingCreated") {
      const args = createdEvent.args;
      // Save to DB via API
      fetch(`/api/offerings/${offeringId}/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escrow_address: args.escrow,
          share_token_address: args.agentShare,
          distributor_address: args.revenueDistributor,
          factory_offering_id: Number(args.offeringId),
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to save contract addresses");
          setStatus("Contracts deployed and saved!");
          setDeployed(true);
        })
        .catch((err) => {
          setError(err.message);
          setStatus("");
        });
    } else {
      setError("Could not find OfferingCreated event in transaction receipt");
      setSaving(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 text-sm text-yellow-500">
        Connect your wallet to deploy contracts
      </div>
    );
  }

  if (deployed) {
    return (
      <div className="p-4 rounded-lg border border-accent/30 bg-accent/5 text-sm text-accent">
        Contracts deployed on-chain. Offering is now live for investment.
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/5">
      <h4 className="font-semibold text-sm mb-2">Deploy to Blockchain</h4>
      <p className="text-xs text-muted mb-3">
        This will deploy AgentShare, Escrow, and RevenueDistributor contracts
        for this offering via the OfferingFactory.
      </p>
      <div className="text-xs text-muted mb-3 space-y-1">
        <p>
          Token: {tokenName} ({symbol})
        </p>
        <p>Revenue share: {revenueSharePct}% ({revenueSharePct * 100} bps)</p>
        <p>
          Supply: {totalShares.toLocaleString()} shares @ $
          {pricePerShare}/share
        </p>
        <p>
          Raise: ${minRaise.toLocaleString()} min / ${maxRaise.toLocaleString()}{" "}
          max
        </p>
      </div>

      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      {status && <p className="text-blue-400 text-xs mb-2">{status}</p>}

      <button
        onClick={handleDeploy}
        disabled={isPending || isConfirming || saving}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {isPending
          ? "Confirm in wallet..."
          : isConfirming
            ? "Waiting for confirmation..."
            : saving
              ? "Saving..."
              : "Deploy Contracts"}
      </button>
    </div>
  );
}
