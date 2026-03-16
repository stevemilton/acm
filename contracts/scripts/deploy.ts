import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "BNB"
  );

  // --- Deploy MockFDUSD ---
  // In production, use real FDUSD: 0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409
  const MockFDUSD = await ethers.getContractFactory("MockFDUSD");
  const mockFDUSD = await MockFDUSD.deploy();
  await mockFDUSD.waitForDeployment();
  const mockFDUSDAddr = await mockFDUSD.getAddress();
  console.log("MockFDUSD deployed to:", mockFDUSDAddr);

  // --- Deploy OfferingFactory ---
  const OfferingFactory = await ethers.getContractFactory("OfferingFactory");
  const factory = await OfferingFactory.deploy(mockFDUSDAddr, deployer.address);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("OfferingFactory deployed to:", factoryAddr);

  // --- Create a demo offering via the factory ---
  const deadline = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days

  const tx = await factory.createOffering({
    agentId: "demo-agent-1",
    name: "RevenueBot Shares",
    symbol: "RBS",
    revenueShareBps: 1500, // 15%
    totalSupply: 10000,
    minRaise: ethers.parseEther("1000"),
    maxRaise: ethers.parseEther("50000"),
    pricePerShare: ethers.parseEther("5"),
    deadline,
    operator: deployer.address,
  });
  await tx.wait();

  // Read the demo offering back from the factory
  const offering = await factory.getOffering(0);
  const total = await factory.totalOfferings();

  console.log(`\nDemo offering created (ID 0 of ${total} total):`);
  console.log(`  AgentShare:          ${offering.agentShare}`);
  console.log(`  Escrow:              ${offering.escrow}`);
  console.log(`  RevenueDistributor:  ${offering.revenueDistributor}`);
  console.log(`  Agent ID:            ${offering.agentId}`);
  console.log(`  Operator:            ${offering.operator}`);

  // --- Summary ---
  const network = await ethers.provider.getNetwork();
  console.log("\n========================================");
  console.log("  ACM Deployment Summary");
  console.log("========================================");
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log("");
  console.log(`MockFDUSD:             ${mockFDUSDAddr}`);
  console.log(`OfferingFactory:       ${factoryAddr}`);
  console.log("");
  console.log("Demo Offering (ID 0):");
  console.log(`  AgentShare:          ${offering.agentShare}`);
  console.log(`  Escrow:              ${offering.escrow}`);
  console.log(`  RevenueDistributor:  ${offering.revenueDistributor}`);
  console.log("========================================");
  console.log(
    "\nUpdate CONTRACT_ADDRESSES in app/src/lib/wagmi.ts with these addresses."
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
