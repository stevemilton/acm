import { http, createConfig } from "wagmi";
import { bscTestnet, bsc } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

// WalletConnect project ID — get yours at https://cloud.walletconnect.com
const WALLET_CONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const config = createConfig({
  chains: [bscTestnet, bsc],
  connectors: [
    injected(),
    ...(WALLET_CONNECT_PROJECT_ID
      ? [walletConnect({ projectId: WALLET_CONNECT_PROJECT_ID })]
      : []),
  ],
  transports: {
    [bscTestnet.id]: http("https://data-seed-prebsc-1-s1.binance.org:8545"),
    [bsc.id]: http("https://bsc-dataseed.binance.org"),
  },
});

// Contract addresses — will be populated after deployment
export const CONTRACT_ADDRESSES = {
  testnet: {
    agentShare: "0x626e805aa69bfd46b166AF9f9f3c53A4ca9C8e43" as `0x${string}`,
    escrow: "0xFd33d98FFfb11889Cf34aFAD1715e021A5642534" as `0x${string}`,
    revenueDistributor: "0x1bb86202870df19C1a9D1d431053D13ee9FA13D4" as `0x${string}`,
    fdusd: "0x65d290f6b2353892a3D0D103F627313e3EB901fC" as `0x${string}`, // ACM Mock FDUSD on BSC testnet
  },
  mainnet: {
    agentShare: "" as `0x${string}`,
    escrow: "" as `0x${string}`,
    revenueDistributor: "" as `0x${string}`,
    fdusd: "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409" as `0x${string}`, // Real FDUSD on BSC
  },
} as const;
