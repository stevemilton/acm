"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useState } from "react";
import { ACTIVE_CHAIN_ID, activeChainConfig } from "@/lib/chain-config";

export function ConnectWalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [showMenu, setShowMenu] = useState(false);

  const isWrongNetwork = isConnected && chain?.id !== ACTIVE_CHAIN_ID;

  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-card-border bg-card text-sm hover:bg-card-border/30 transition-colors"
        >
          {isWrongNetwork && (
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
          )}
          <span className="text-accent font-mono text-xs">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-card-border bg-card shadow-lg z-50">
            {isWrongNetwork && (
              <button
                onClick={() => {
                  switchChain({ chainId: ACTIVE_CHAIN_ID });
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-yellow-500 hover:bg-card-border/30"
              >
                Switch to {activeChainConfig.name}
              </button>
            )}
            <button
              onClick={() => {
                disconnect();
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-card-border/30"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isPending}
        className="px-4 py-2 rounded-lg border border-accent/50 text-accent text-sm font-medium hover:bg-accent/5 transition-colors disabled:opacity-50"
      >
        {isPending ? "Connecting..." : "Connect Wallet"}
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-card-border bg-card shadow-lg z-50">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => {
                connect({ connector, chainId: ACTIVE_CHAIN_ID });
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-3 text-sm hover:bg-card-border/30 transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
