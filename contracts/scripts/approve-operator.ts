import { ethers } from "hardhat";

/**
 * Approve an operator on the OfferingFactory so they can call createOffering.
 *
 * Usage:
 *   OPERATOR_ADDRESS=0x... npx hardhat run scripts/approve-operator.ts --network bscTestnet
 *
 * If OPERATOR_ADDRESS is not set, defaults to the deployer wallet.
 */

const FACTORY_ADDRESS = "0x2f3E26b798B4D7906577F52a65BaA991Ea99C67A";

async function main() {
  const [deployer] = await ethers.getSigners();
  const operatorAddress = process.env.OPERATOR_ADDRESS || deployer.address;

  console.log(`Deployer (owner):  ${deployer.address}`);
  console.log(`Operator to approve: ${operatorAddress}`);
  console.log(`Factory:           ${FACTORY_ADDRESS}`);

  const factory = await ethers.getContractAt(
    "OfferingFactory",
    FACTORY_ADDRESS
  );

  // Check current status
  const alreadyApproved = await factory.approvedOperators(operatorAddress);
  if (alreadyApproved) {
    console.log(`\nOperator ${operatorAddress} is already approved. Nothing to do.`);
    return;
  }

  // Approve
  console.log("\nSending setApprovedOperator transaction...");
  const tx = await factory.setApprovedOperator(operatorAddress, true);
  console.log(`TX hash: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block ${receipt?.blockNumber}.`);
  console.log(`Explorer: https://testnet.bscscan.com/tx/${tx.hash}`);

  // Verify (wait a moment for RPC to catch up)
  await new Promise((r) => setTimeout(r, 3000));
  const nowApproved = await factory.approvedOperators(operatorAddress);
  console.log(`\nVerification: approvedOperators(${operatorAddress}) = ${nowApproved}`);

  if (nowApproved) {
    console.log("Operator approved successfully.");
  } else {
    // Note: BSC testnet RPC can lag on reads. Check explorer to confirm.
    console.log("WARNING: RPC read returned false — this may be RPC lag.");
    console.log("Check the explorer link above to confirm the tx succeeded.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
