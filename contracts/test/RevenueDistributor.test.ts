import { expect } from "chai";
import { ethers } from "hardhat";
import { MockFDUSD, AgentShare, RevenueDistributor } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("RevenueDistributor", function () {
  let fdusd: MockFDUSD;
  let share: AgentShare;
  let distributor: RevenueDistributor;
  let platformWallet: SignerWithAddress;
  let operator: SignerWithAddress;
  let investor1: SignerWithAddress;
  let investor2: SignerWithAddress;
  let other: SignerWithAddress;

  const TOTAL_SHARES = ethers.parseEther("10000");
  const REVENUE_SHARE_BPS = BigInt(1500); // 15%

  beforeEach(async function () {
    [platformWallet, operator, investor1, investor2, other] = await ethers.getSigners();

    // Deploy MockFDUSD
    const FdusdFactory = await ethers.getContractFactory("MockFDUSD");
    fdusd = await FdusdFactory.deploy();
    await fdusd.waitForDeployment();

    // Deploy AgentShare (operator owns initially)
    const ShareFactory = await ethers.getContractFactory("AgentShare");
    share = await ShareFactory.deploy(
      "Revenue Share", "RS", "agent-rev", REVENUE_SHARE_BPS, TOTAL_SHARES, operator.address
    );
    await share.waitForDeployment();

    // Transfer some shares to investors (simulating post-escrow)
    await share.connect(operator).purchaseShares(investor1.address, ethers.parseEther("600"));
    await share.connect(operator).purchaseShares(investor2.address, ethers.parseEther("400"));

    // Deploy RevenueDistributor
    const DistFactory = await ethers.getContractFactory("RevenueDistributor");
    distributor = await DistFactory.deploy(
      await fdusd.getAddress(),
      await share.getAddress(),
      platformWallet.address,
      operator.address
    );
    await distributor.waitForDeployment();

    // Mint FDUSD to operator for distribution
    await fdusd.mint(operator.address, ethers.parseEther("100000"));
  });

  describe("constructor", function () {
    it("sets all parameters correctly", async function () {
      expect(await distributor.paymentToken()).to.equal(await fdusd.getAddress());
      expect(await distributor.shareToken()).to.equal(await share.getAddress());
      expect(await distributor.platformWallet()).to.equal(platformWallet.address);
      expect(await distributor.operatorWallet()).to.equal(operator.address);
      expect(await distributor.owner()).to.equal(operator.address);
    });

    it("PLATFORM_FEE_BPS is 500 (5%)", async function () {
      expect(await distributor.PLATFORM_FEE_BPS()).to.equal(BigInt(500));
    });
  });

  describe("distribute", function () {
    const grossRevenue = ethers.parseEther("1000");

    it("splits revenue correctly (5% platform, 15% revenue share)", async function () {
      const platformBefore = await fdusd.balanceOf(platformWallet.address);
      const operatorBefore = await fdusd.balanceOf(operator.address);

      await fdusd.connect(operator).approve(await distributor.getAddress(), grossRevenue);
      await distributor.connect(operator).distribute(grossRevenue);

      const platformAfter = await fdusd.balanceOf(platformWallet.address);
      const operatorAfter = await fdusd.balanceOf(operator.address);

      // Platform fee: 1000 * 5% = 50
      const platformFee = ethers.parseEther("50");
      expect(platformAfter - platformBefore).to.equal(platformFee);

      // After fee: 950
      // Investor amount: 950 * 15% = 142.5
      // Operator amount: 950 - 142.5 = 807.5
      // Operator net: -1000 (sent) + 807.5 (received) = -192.5
      const operatorAmount = ethers.parseEther("807.5");
      expect(operatorBefore - operatorAfter).to.equal(grossRevenue - operatorAmount);
    });

    it("emits RevenueReceived event with correct amounts", async function () {
      await fdusd.connect(operator).approve(await distributor.getAddress(), grossRevenue);
      await expect(distributor.connect(operator).distribute(grossRevenue))
        .to.emit(distributor, "RevenueReceived")
        .withArgs(
          grossRevenue,
          ethers.parseEther("50"),     // platform fee
          ethers.parseEther("807.5"),  // operator
          ethers.parseEther("142.5")   // investors
        );
    });

    it("reverts when called by non-owner", async function () {
      await fdusd.connect(investor1).approve(await distributor.getAddress(), grossRevenue);
      await expect(
        distributor.connect(investor1).distribute(grossRevenue)
      ).to.be.revertedWithCustomError(distributor, "OwnableUnauthorizedAccount");
    });

    it("updates cumulativeRevenuePerToken", async function () {
      await fdusd.connect(operator).approve(await distributor.getAddress(), grossRevenue);
      await distributor.connect(operator).distribute(grossRevenue);

      const cumulative = await distributor.cumulativeRevenuePerToken();
      // investorAmount = 142.5 FDUSD, totalShares = 1000 (600 + 400)
      // cumulativeRevenuePerToken = 142.5e18 * 1e18 / 1000e18 = 142500000000000000 (0.1425e18)
      const totalShares = ethers.parseEther("1000");
      const investorAmount = ethers.parseEther("142.5");
      const expected = (investorAmount * BigInt("1000000000000000000")) / totalShares;
      expect(cumulative).to.equal(expected);
    });
  });

  describe("claim", function () {
    const grossRevenue = ethers.parseEther("1000");

    beforeEach(async function () {
      await fdusd.connect(operator).approve(await distributor.getAddress(), grossRevenue);
      await distributor.connect(operator).distribute(grossRevenue);
    });

    it("pays investor1 proportional to their shares (60%)", async function () {
      const balBefore = await fdusd.balanceOf(investor1.address);
      await distributor.connect(investor1).claim();
      const balAfter = await fdusd.balanceOf(investor1.address);

      // investor1 has 600 of 1000 shares = 60% of 142.5 = 85.5
      expect(balAfter - balBefore).to.equal(ethers.parseEther("85.5"));
    });

    it("pays investor2 proportional to their shares (40%)", async function () {
      const balBefore = await fdusd.balanceOf(investor2.address);
      await distributor.connect(investor2).claim();
      const balAfter = await fdusd.balanceOf(investor2.address);

      // investor2 has 400 of 1000 shares = 40% of 142.5 = 57
      expect(balAfter - balBefore).to.equal(ethers.parseEther("57"));
    });

    it("emits InvestorClaimed event", async function () {
      await expect(distributor.connect(investor1).claim())
        .to.emit(distributor, "InvestorClaimed")
        .withArgs(investor1.address, ethers.parseEther("85.5"));
    });

    it("reverts if no shares held", async function () {
      await expect(
        distributor.connect(other).claim()
      ).to.be.revertedWith("No shares");
    });

    it("reverts if nothing to claim (already claimed)", async function () {
      await distributor.connect(investor1).claim();
      await expect(
        distributor.connect(investor1).claim()
      ).to.be.revertedWith("Nothing to claim");
    });

    it("multi-investor proportional claims sum to investorAmount", async function () {
      const bal1Before = await fdusd.balanceOf(investor1.address);
      const bal2Before = await fdusd.balanceOf(investor2.address);

      await distributor.connect(investor1).claim();
      await distributor.connect(investor2).claim();

      const claimed1 = (await fdusd.balanceOf(investor1.address)) - bal1Before;
      const claimed2 = (await fdusd.balanceOf(investor2.address)) - bal2Before;

      // Total claimed should equal investor amount (142.5)
      expect(claimed1 + claimed2).to.equal(ethers.parseEther("142.5"));
    });

    it("handles multiple distribution rounds correctly", async function () {
      // Claim first round
      await distributor.connect(investor1).claim();

      // Second distribution
      const secondGross = ethers.parseEther("2000");
      await fdusd.connect(operator).approve(await distributor.getAddress(), secondGross);
      await distributor.connect(operator).distribute(secondGross);

      // investor1 claims second round
      const balBefore = await fdusd.balanceOf(investor1.address);
      await distributor.connect(investor1).claim();
      const balAfter = await fdusd.balanceOf(investor1.address);

      // Second round investor amount: 2000 * 0.95 * 0.15 = 285
      // investor1 share: 285 * 60% = 171
      expect(balAfter - balBefore).to.equal(ethers.parseEther("171"));
    });

    it("investor who hasn't claimed gets cumulative from multiple rounds", async function () {
      // Second distribution without investor2 claiming first
      const secondGross = ethers.parseEther("2000");
      await fdusd.connect(operator).approve(await distributor.getAddress(), secondGross);
      await distributor.connect(operator).distribute(secondGross);

      // investor2 claims both rounds at once
      const balBefore = await fdusd.balanceOf(investor2.address);
      await distributor.connect(investor2).claim();
      const balAfter = await fdusd.balanceOf(investor2.address);

      // Round 1: 142.5 * 40% = 57
      // Round 2: 285 * 40% = 114
      // Total: 171
      expect(balAfter - balBefore).to.equal(ethers.parseEther("171"));
    });
  });
});
