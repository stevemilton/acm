import { http, createConfig } from "wagmi";
import { bscTestnet, bsc } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { CHAIN_CONFIG, ACTIVE_CHAIN_ID } from "@/lib/chain-config";

// WalletConnect project ID — get yours at https://cloud.walletconnect.com
const WALLET_CONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

// Put active chain first so wagmi treats it as the default
const activeChain = CHAIN_CONFIG[ACTIVE_CHAIN_ID].chain;
const chains =
  ACTIVE_CHAIN_ID === 56 ? [bsc, bscTestnet] : [bscTestnet, bsc];

export const config = createConfig({
  chains: chains as unknown as readonly [typeof bscTestnet, typeof bsc],
  connectors: [
    injected(),
    ...(WALLET_CONNECT_PROJECT_ID
      ? [walletConnect({ projectId: WALLET_CONNECT_PROJECT_ID })]
      : []),
  ],
  transports: {
    [bscTestnet.id]: http(CHAIN_CONFIG[97].rpc),
    [bsc.id]: http(CHAIN_CONFIG[56].rpc),
  },
});

// Contract addresses derived from chain config — kept for backward compatibility
export const CONTRACT_ADDRESSES = {
  testnet: CHAIN_CONFIG[97].contracts,
  mainnet: CHAIN_CONFIG[56].contracts,
} as const;
