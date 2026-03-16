"use client";

import dynamic from "next/dynamic";

const EscrowStatusInner = dynamic(
  () =>
    import("@/components/wallet/escrow-status").then((mod) => mod.EscrowStatus),
  { ssr: false }
);

const ClaimRevenueInner = dynamic(
  () =>
    import("@/components/wallet/claim-revenue").then((mod) => mod.ClaimRevenue),
  { ssr: false }
);

export function EscrowStatus({ escrowAddress }: { escrowAddress?: string }) {
  return <EscrowStatusInner escrowAddress={escrowAddress} />;
}

export function ClaimRevenue({
  distributorAddress,
  shareTokenAddress,
}: {
  distributorAddress?: string;
  shareTokenAddress?: string;
}) {
  return (
    <ClaimRevenueInner
      distributorAddress={distributorAddress}
      shareTokenAddress={shareTokenAddress}
    />
  );
}
