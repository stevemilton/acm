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

const DeployOfferingInner = dynamic(
  () =>
    import("@/components/wallet/deploy-offering").then(
      (mod) => mod.DeployOffering
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

export function DeployOffering(props: {
  offeringId: string;
  agentId: string;
  agentName: string;
  revenueSharePct: number;
  totalShares: number;
  pricePerShare: number;
  minRaise: number;
  maxRaise: number;
  durationDays: number;
}) {
  return <DeployOfferingInner {...props} />;
}
