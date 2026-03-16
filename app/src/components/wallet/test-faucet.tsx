"use client";

import { useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { MOCK_FDUSD_ABI } from "@/lib/contracts";
import { ACTIVE_CHAIN_ID, activeChainConfig, getFdusdAddress, getExplorerUrl } from "@/lib/chain-config";

const MINT_AMOUNT = parseUnits("10000", 18); // 10,000 FDUSD

export function TestFaucet() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fdusdAddress = getFdusdAddress();

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: fdusdAddress,
    abi: MOCK_FDUSD_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { isLoading: isTxPending } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Only show on the active chain if it's a testnet
  if (!activeChainConfig.isTestnet || chainId !== ACTIVE_CHAIN_ID) {
    return null;
  }

  if (!isConnected || !address) {
    return null;
  }

  async function handleMint() {
    if (!address) return;
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const hash = await writeContractAsync({
        address: fdusdAddress,
        abi: MOCK_FDUSD_ABI,
        functionName: "mint",
        args: [address, MINT_AMOUNT],
      });

      setTxHash(hash);
      setSuccess(true);
      // Refetch balance after a short delay
      setTimeout(() => refetchBalance(), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mint failed");
    } finally {
      setLoading(false);
    }
  }

  const formattedBalance = balance ? formatUnits(balance, 18) : "0";

  return (
    <div className="p-4 rounded-xl border border-card-border bg-card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Test FDUSD Faucet</h3>
          <p className="text-xs text-muted">{activeChainConfig.name} only</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500">
          Testnet
        </span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted">Your FDUSD Balance</span>
        <span className="text-sm font-medium">
          {Number(formattedBalance).toLocaleString()} FDUSD
        </span>
      </div>

      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

      {success && txHash && (
        <div className="mb-2 text-xs">
          <span className="text-accent">Minted 10,000 FDUSD! </span>
          <a
            href={getExplorerUrl("tx", txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent/70 hover:underline"
          >
            View tx &rarr;
          </a>
        </div>
      )}

      <button
        onClick={handleMint}
        disabled={loading || isTxPending}
        className="w-full py-2 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {loading || isTxPending ? "Minting..." : "Get Test FDUSD"}
      </button>
    </div>
  );
}
