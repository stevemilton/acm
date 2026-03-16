"use client";

import dynamic from "next/dynamic";

export const TestFaucet = dynamic(
  () =>
    import("@/components/wallet/test-faucet").then((mod) => mod.TestFaucet),
  { ssr: false }
);
