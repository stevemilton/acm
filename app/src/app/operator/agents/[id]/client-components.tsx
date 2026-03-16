"use client";

import dynamic from "next/dynamic";

const EscrowManageInner = dynamic(
  () =>
    import("@/components/wallet/escrow-manage").then(
      (mod) => mod.EscrowManage
    ),
  { ssr: false }
);

const DistributeRevenueInner = dynamic(
  () =>
    import("@/components/wallet/distribute-revenue").then(
      (mod) => mod.DistributeRevenue
    ),
  { ssr: false }
);

export function EscrowManage({
  escrowAddress,
}: {
  escrowAddress?: string;
}) {
  return <EscrowManageInner escrowAddress={escrowAddress} />;
}

export function DistributeRevenue({
  distributorAddress,
  fdusdAddress,
}: {
  distributorAddress?: string;
  fdusdAddress?: string;
}) {
  return (
    <DistributeRevenueInner
      distributorAddress={distributorAddress}
      fdusdAddress={fdusdAddress}
    />
  );
}
