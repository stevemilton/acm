import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "BNB"
  );

  // --- Deploy a mock FDUSD token for testnet ---
  // In production, use real FDUSD: 0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409
  const MockToken = await ethers.getContractFactory("AgentShare");
  const mockFDUSD = await MockToken.deploy(
    "Mock FDUSD",
    "mFDUSD",
    "mock-fdusd",
    1, // revenueShareBps (irrelevant for mock)
    ethers.parseEther("1000000"), // 1M supply
    deployer.address
  );
  await mockFDUSD.waitForDeployment();
  const mockFDUSDAddr = await mockFDUSD.getAddress();
  console.log("Mock FDUSD deployed to:", mockFDUSDAddr);

  // --- Deploy AgentShare token ---
  const AgentShare = await ethers.getContractFactory("AgentShare");
  const agentShare = await AgentShare.deploy(
    "RevenueBot Share",
    "RVBOT",
    "demo-agent-1",
    1500, // 15% revenue share
    1000, // max 1000 shares
    deployer.address
  );
  await agentShare.waitForDeployment();
  const agentShareAddr = await agentShare.getAddress();
  console.log("AgentShare deployed to:", agentShareAddr);

  // --- Deploy Escrow ---
  const Escrow = await ethers.getContractFactory("Escrow");
  const deadline = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const escrow = await Escrow.deploy(
    mockFDUSDAddr, // paymentToken
    agentShareAddr, // shareToken
    ethers.parseEther("100"), // minRaise: 100 FDUSD
    ethers.parseEther("10000"), // maxRaise: 10,000 FDUSD
    ethers.parseEther("10"), // pricePerShare: 10 FDUSD
    deadline,
    deployer.address
  );
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("Escrow deployed to:", escrowAddr);

  // --- Deploy RevenueDistributor ---
  const RevenueDistributor = await ethers.getContractFactory(
    "RevenueDistributor"
  );
  const revenueDistributor = await RevenueDistributor.deploy(
    mockFDUSDAddr, // paymentToken
    agentShareAddr, // shareToken
    deployer.address, // platformWallet
    deployer.address // operatorWallet
  );
  await revenueDistributor.waitForDeployment();
  const revenueDistributorAddr = await revenueDistributor.getAddress();
  console.log("RevenueDistributor deployed to:", revenueDistributorAddr);

  // --- Summary ---
  const network = await ethers.provider.getNetwork();
  console.log("\n========================================");
  console.log("  ACM Deployment Summary");
  console.log("========================================");
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log("");
  console.log(`Mock FDUSD:          ${mockFDUSDAddr}`);
  console.log(`AgentShare:          ${agentShareAddr}`);
  console.log(`Escrow:              ${escrowAddr}`);
  console.log(`RevenueDistributor:  ${revenueDistributorAddr}`);
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
