import { bscTestnet, bsc } from "viem/chains";

export type SupportedChainId = 97 | 56; // BSC testnet | BSC mainnet

export const CHAIN_CONFIG = {
  97: {
    chain: bscTestnet,
    name: "BNB Testnet",
    explorer: "https://testnet.bscscan.com",
    rpc: "https://data-seed-prebsc-1-s1.binance.org:8545",
    isTestnet: true,
    contracts: {
      agentShare: "0xa8b47e1f450a484c3D40622fB23C1e825A7A25F9" as `0x${string}`,
      escrow: "0x0c50cc920489B3FE39670708071c4eC959BA867F" as `0x${string}`,
      revenueDistributor: "0x3217ED63cB3ee9758c7b0D1047B73F83b9585fAF" as `0x${string}`,
      fdusd: "0xAceB12E8E2F7126657E290BE382dA2926C1926FA" as `0x${string}`,
      offeringFactory: "0xe6C3AA4130c4Bf68dACEEE6F1cb8467dF2E262DA" as `0x${string}`,
    },
  },
  56: {
    chain: bsc,
    name: "BNB Chain",
    explorer: "https://bscscan.com",
    rpc: "https://bsc-dataseed.binance.org",
    isTestnet: false,
    contracts: {
      agentShare: "" as `0x${string}`,
      escrow: "" as `0x${string}`,
      revenueDistributor: "" as `0x${string}`,
      fdusd: "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409" as `0x${string}`,
      offeringFactory: "" as `0x${string}`,
    },
  },
} as const;

// Active chain based on environment
export const ACTIVE_CHAIN_ID: SupportedChainId =
  (process.env.NEXT_PUBLIC_CHAIN_ID
    ? Number(process.env.NEXT_PUBLIC_CHAIN_ID)
    : 97) as SupportedChainId;

export const activeChainConfig = CHAIN_CONFIG[ACTIVE_CHAIN_ID];

// Helper to get explorer URL
export function getExplorerUrl(
  type: "tx" | "address" | "token",
  hash: string,
  chainId?: SupportedChainId
): string {
  const config = CHAIN_CONFIG[chainId ?? ACTIVE_CHAIN_ID];
  return `${config.explorer}/${type}/${hash}`;
}

// Helper to get FDUSD address for a chain
export function getFdusdAddress(chainId?: SupportedChainId): `0x${string}` {
  return CHAIN_CONFIG[chainId ?? ACTIVE_CHAIN_ID].contracts.fdusd;
}

// Helper to get contract address by name
export function getContractAddress(
  name: keyof (typeof CHAIN_CONFIG)[97]["contracts"],
  chainId?: SupportedChainId
): `0x${string}` {
  return CHAIN_CONFIG[chainId ?? ACTIVE_CHAIN_ID].contracts[name];
}
