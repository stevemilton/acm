import { ethers } from "hardhat";

/**
 * E2E Testnet Cycle — Sprint 002
 *
 * Executes the full ACM lifecycle on BNB testnet:
 *   1. Redeploy OfferingFactory (with fixed Escrow that transfers shares)
 *   2. Create offering via factory
 *   3. Mint test FDUSD for investor
 *   4. Invest: FDUSD approve → escrow deposit → verify AgentShare tokens
 *   5. Release escrow (operator triggers after minRaise met)
 *   6. Distribute revenue (operator approves FDUSD → distribute)
 *   7. Claim revenue (investor claims accumulated FDUSD)
 *   8. Print full evidence report
 *
 * Usage:
 *   npx hardhat run scripts/e2e-cycle.ts --network bscTestnet
 */

const MOCK_FDUSD = "0xAceB12E8E2F7126657E290BE382dA2926C1926FA";

// Helpers
function explorer(type: "tx" | "address", hash: string) {
  return `https://testnet.bscscan.com/${type}/${hash}`;
}

async function waitForConfirmation(tx: { hash: string; wait: () => Promise<any> }) {
  console.log(`  TX: ${tx.hash}`);
  console.log(`  Explorer: ${explorer("tx", tx.hash)}`);
  const receipt = await tx.wait();
  console.log(`  Confirmed in block ${receipt?.blockNumber}`);
  return receipt;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddr = deployer.address;

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║     ACM E2E Testnet Cycle — Sprint 002          ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`Deployer/Operator: ${deployerAddr}`);
  console.log(
    `BNB Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployerAddr))} BNB`
  );
  console.log(`MockFDUSD: ${MOCK_FDUSD}\n`);

  // Get MockFDUSD contract
  const fdusd = await ethers.getContractAt("MockFDUSD", MOCK_FDUSD);
  const fdusdBalance = await fdusd.balanceOf(deployerAddr);
  console.log(`FDUSD Balance: ${ethers.formatEther(fdusdBalance)} FDUSD\n`);

  const evidence: Record<string, string> = {};

  // ─────────────────────────────────────────────────────────
  // STEP 1: Redeploy OfferingFactory (includes fixed Escrow)
  // ─────────────────────────────────────────────────────────
  console.log("═══ STEP 1: Deploy OfferingFactory (with fixed Escrow) ═══");
  const OfferingFactory = await ethers.getContractFactory("OfferingFactory");
  const factory = await OfferingFactory.deploy(MOCK_FDUSD, deployerAddr);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log(`  OfferingFactory deployed: ${factoryAddr}`);
  console.log(`  Explorer: ${explorer("address", factoryAddr)}`);
  evidence["factory_address"] = factoryAddr;
  evidence["factory_deploy_tx"] = factory.deploymentTransaction()?.hash ?? "N/A";

  // Approve deployer as operator
  console.log("\n  Approving deployer as operator...");
  const approveTx = await factory.setApprovedOperator(deployerAddr, true);
  await waitForConfirmation(approveTx);
  evidence["operator_approve_tx"] = approveTx.hash;
  console.log("");

  // ─────────────────────────────────────────────────────────
  // STEP 2: Create offering via factory
  // ─────────────────────────────────────────────────────────
  console.log("═══ STEP 2: Create Offering via Factory ═══");
  const deadline = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days
  const params = {
    agentId: "e2e-test-agent",
    name: "E2E Test Shares",
    symbol: "E2E",
    revenueShareBps: 1500, // 15% to investors
    totalSupply: 10000,
    minRaise: ethers.parseEther("100"),   // 100 FDUSD min
    maxRaise: ethers.parseEther("50000"),
    pricePerShare: ethers.parseEther("5"), // 5 FDUSD per share
    deadline,
    operator: deployerAddr,
  };
  console.log(`  Agent ID: ${params.agentId}`);
  console.log(`  Symbol: ${params.symbol}`);
  console.log(`  Revenue Share: ${params.revenueShareBps / 100}%`);
  console.log(`  Min Raise: ${ethers.formatEther(params.minRaise)} FDUSD`);
  console.log(`  Price/Share: ${ethers.formatEther(params.pricePerShare)} FDUSD`);
  console.log(`  Total Supply: ${params.totalSupply} shares`);

  const createTx = await factory.createOffering(params);
  const createReceipt = await waitForConfirmation(createTx);
  evidence["create_offering_tx"] = createTx.hash;

  // Read the offering back
  const offering = await factory.getOffering(0);
  const escrowAddr = offering.escrow;
  const shareAddr = offering.agentShare;
  const distributorAddr = offering.revenueDistributor;

  console.log(`\n  Offering ID: 0`);
  console.log(`  AgentShare:          ${shareAddr}`);
  console.log(`  Escrow:              ${escrowAddr}`);
  console.log(`  RevenueDistributor:  ${distributorAddr}`);
  evidence["agent_share_address"] = shareAddr;
  evidence["escrow_address"] = escrowAddr;
  evidence["distributor_address"] = distributorAddr;
  console.log("");

  // Get contract instances
  const escrow = await ethers.getContractAt("Escrow", escrowAddr);
  const agentShare = await ethers.getContractAt("AgentShare", shareAddr);
  const distributor = await ethers.getContractAt("RevenueDistributor", distributorAddr);

  // ─────────────────────────────────────────────────────────
  // STEP 3: Mint test FDUSD for investor (using deployer as investor too)
  // ─────────────────────────────────────────────────────────
  console.log("═══ STEP 3: Mint Test FDUSD ═══");
  const investAmount = ethers.parseEther("500"); // 500 FDUSD = 100 shares
  const revenueAmount = ethers.parseEther("1000"); // 1000 FDUSD revenue to distribute
  const totalMint = investAmount + revenueAmount;

  console.log(`  Minting ${ethers.formatEther(totalMint)} FDUSD...`);
  const mintTx = await fdusd.mint(deployerAddr, totalMint);
  await waitForConfirmation(mintTx);
  evidence["mint_fdusd_tx"] = mintTx.hash;

  const postMintBalance = await fdusd.balanceOf(deployerAddr);
  console.log(`  Post-mint balance: ${ethers.formatEther(postMintBalance)} FDUSD\n`);

  // ─────────────────────────────────────────────────────────
  // STEP 4: Invest — approve + deposit
  // ─────────────────────────────────────────────────────────
  console.log("═══ STEP 4: Invest (approve → deposit) ═══");

  // Step 4a: Approve escrow to spend FDUSD
  console.log(`  Approving ${ethers.formatEther(investAmount)} FDUSD for escrow...`);
  const approveFdusdTx = await fdusd.approve(escrowAddr, investAmount);
  await waitForConfirmation(approveFdusdTx);
  evidence["approve_escrow_tx"] = approveFdusdTx.hash;

  // Step 4b: Deposit into escrow
  console.log(`\n  Depositing ${ethers.formatEther(investAmount)} FDUSD...`);
  const depositTx = await escrow.deposit(investAmount);
  await waitForConfirmation(depositTx);
  evidence["deposit_tx"] = depositTx.hash;

  // Verify
  const escrowTotalRaised = await escrow.totalRaised();
  const shareBalance = await agentShare.balanceOf(deployerAddr);
  const escrowStatus = await escrow.status();

  console.log(`\n  Escrow total raised: ${ethers.formatEther(escrowTotalRaised)} FDUSD`);
  console.log(`  Investor share balance: ${shareBalance.toString()} E2E tokens`);
  console.log(`  Escrow status: ${["Open", "Funded", "Refunding"][Number(escrowStatus)]}`);
  evidence["total_raised"] = ethers.formatEther(escrowTotalRaised);
  evidence["investor_share_balance"] = shareBalance.toString();
  console.log("");

  // ─────────────────────────────────────────────────────────
  // STEP 5: Release escrow (operator action)
  // ─────────────────────────────────────────────────────────
  console.log("═══ STEP 5: Release Escrow ═══");
  console.log(`  Min raise: ${ethers.formatEther(await escrow.minRaise())} FDUSD`);
  console.log(`  Total raised: ${ethers.formatEther(escrowTotalRaised)} FDUSD (meets min)`);

  const releaseTx = await escrow.release();
  await waitForConfirmation(releaseTx);
  evidence["release_tx"] = releaseTx.hash;

  const postReleaseStatus = await escrow.status();
  const operatorFdusdAfterRelease = await fdusd.balanceOf(deployerAddr);
  console.log(`  Escrow status: ${["Open", "Funded", "Refunding"][Number(postReleaseStatus)]}`);
  console.log(`  Operator FDUSD after release: ${ethers.formatEther(operatorFdusdAfterRelease)} FDUSD`);
  evidence["escrow_status_after_release"] = ["Open", "Funded", "Refunding"][Number(postReleaseStatus)];
  console.log("");

  // ─────────────────────────────────────────────────────────
  // STEP 6: Distribute revenue
  // ─────────────────────────────────────────────────────────
  console.log("═══ STEP 6: Distribute Revenue ═══");
  console.log(`  Distributing ${ethers.formatEther(revenueAmount)} FDUSD gross revenue...`);
  console.log(`  Expected split:`);
  console.log(`    Platform (5%):     ${ethers.formatEther(revenueAmount * BigInt(500) / BigInt(10000))} FDUSD`);
  const afterFee = revenueAmount * BigInt(9500) / BigInt(10000);
  const investorShare = afterFee * BigInt(1500) / BigInt(10000);
  const operatorShare = afterFee - investorShare;
  console.log(`    Operator (85% of 95%): ${ethers.formatEther(operatorShare)} FDUSD`);
  console.log(`    Investors (15% of 95%): ${ethers.formatEther(investorShare)} FDUSD`);

  // Step 6a: Approve distributor to pull FDUSD
  console.log(`\n  Approving distributor for ${ethers.formatEther(revenueAmount)} FDUSD...`);
  const approveDistTx = await fdusd.approve(distributorAddr, revenueAmount);
  await waitForConfirmation(approveDistTx);
  evidence["approve_distributor_tx"] = approveDistTx.hash;

  // Step 6b: Distribute
  console.log(`\n  Calling distribute(${ethers.formatEther(revenueAmount)})...`);
  const distributeTx = await distributor.distribute(revenueAmount);
  await waitForConfirmation(distributeTx);
  evidence["distribute_tx"] = distributeTx.hash;

  const cumulativeRPT = await distributor.cumulativeRevenuePerToken();
  console.log(`  Cumulative revenue/token: ${cumulativeRPT.toString()}`);
  evidence["cumulative_revenue_per_token"] = cumulativeRPT.toString();
  console.log("");

  // ─────────────────────────────────────────────────────────
  // STEP 7: Claim revenue (investor)
  // ─────────────────────────────────────────────────────────
  console.log("═══ STEP 7: Claim Revenue ═══");
  const preClaimBalance = await fdusd.balanceOf(deployerAddr);
  console.log(`  Pre-claim FDUSD balance: ${ethers.formatEther(preClaimBalance)}`);

  const claimTx = await distributor.claim();
  await waitForConfirmation(claimTx);
  evidence["claim_tx"] = claimTx.hash;

  const postClaimBalance = await fdusd.balanceOf(deployerAddr);
  const claimed = postClaimBalance - preClaimBalance;
  console.log(`  Post-claim FDUSD balance: ${ethers.formatEther(postClaimBalance)}`);
  console.log(`  FDUSD claimed: ${ethers.formatEther(claimed)}`);
  evidence["fdusd_claimed"] = ethers.formatEther(claimed);
  console.log("");

  // ─────────────────────────────────────────────────────────
  // EVIDENCE SUMMARY
  // ─────────────────────────────────────────────────────────
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║           E2E CYCLE EVIDENCE SUMMARY            ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("");
  for (const [key, value] of Object.entries(evidence)) {
    const paddedKey = key.padEnd(35);
    if (value.startsWith("0x") && value.length === 42) {
      console.log(`  ${paddedKey} ${value}`);
      console.log(`  ${"".padEnd(35)} ${explorer("address", value)}`);
    } else if (value.startsWith("0x") && value.length === 66) {
      console.log(`  ${paddedKey} ${value}`);
      console.log(`  ${"".padEnd(35)} ${explorer("tx", value)}`);
    } else {
      console.log(`  ${paddedKey} ${value}`);
    }
  }

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║           E2E CYCLE COMPLETE ✓                  ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("\nUpdate chain-config.ts with:");
  console.log(`  offeringFactory: "${factoryAddr}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ E2E CYCLE FAILED:");
    console.error(error);
    process.exit(1);
  });
