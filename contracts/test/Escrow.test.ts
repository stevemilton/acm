import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MockFDUSD, AgentShare, Escrow } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Escrow", function () {
  let fdusd: MockFDUSD;
  let share: AgentShare;
  let escrow: Escrow;
  let operator: SignerWithAddress;
  let investor1: SignerWithAddress;
  let investor2: SignerWithAddress;
  let other: SignerWithAddress;

  const TOTAL_SHARES = ethers.parseEther("10000");
  const PRICE_PER_SHARE = ethers.parseEther("5");
  const MIN_RAISE = ethers.parseEther("100");
  const MAX_RAISE = ethers.parseEther("50000");
  const REVENUE_SHARE_BPS = BigInt(1500);

  let deadline: number;

  beforeEach(async function () {
    [operator, investor1, investor2, other] = await ethers.getSigners();

    // Deploy MockFDUSD
    const FdusdFactory = await ethers.getContractFactory("MockFDUSD");
    fdusd = await FdusdFactory.deploy();
    await fdusd.waitForDeployment();

    // Deploy AgentShare (operator is initial owner, will transfer to escrow)
    const ShareFactory = await ethers.getContractFactory("AgentShare");
    share = await ShareFactory.deploy(
      "Test Share", "TS", "agent-1", REVENUE_SHARE_BPS, TOTAL_SHARES, operator.address
    );
    await share.waitForDeployment();

    // Deadline 1 hour from now
    deadline = (await time.latest()) + 3600;

    // Deploy Escrow
    const EscrowFactory = await ethers.getContractFactory("Escrow");
    escrow = await EscrowFactory.deploy(
      await fdusd.getAddress(),
      await share.getAddress(),
      MIN_RAISE,
      MAX_RAISE,
      PRICE_PER_SHARE,
      deadline,
      operator.address
    );
    await escrow.waitForDeployment();

    // Transfer AgentShare ownership to Escrow (mirrors factory flow)
    await share.connect(operator).transferOwnership(await escrow.getAddress());

    // Mint FDUSD to investors
    await fdusd.mint(investor1.address, ethers.parseEther("10000"));
    await fdusd.mint(investor2.address, ethers.parseEther("10000"));
  });

  describe("constructor", function () {
    it("sets all parameters correctly", async function () {
      expect(await escrow.paymentToken()).to.equal(await fdusd.getAddress());
      expect(await escrow.shareToken()).to.equal(await share.getAddress());
      expect(await escrow.minRaise()).to.equal(MIN_RAISE);
      expect(await escrow.maxRaise()).to.equal(MAX_RAISE);
      expect(await escrow.pricePerShare()).to.equal(PRICE_PER_SHARE);
      expect(await escrow.deadline()).to.equal(BigInt(deadline));
      expect(await escrow.owner()).to.equal(operator.address);
    });

    it("starts in Open status", async function () {
      expect(await escrow.status()).to.equal(BigInt(0)); // Open
    });
  });

  describe("deposit", function () {
    it("accepts deposit and transfers shares", async function () {
      const amount = ethers.parseEther("500"); // 100 shares
      await fdusd.connect(investor1).approve(await escrow.getAddress(), amount);
      await escrow.connect(investor1).deposit(amount);

      expect(await escrow.deposits(investor1.address)).to.equal(amount);
      expect(await escrow.totalRaised()).to.equal(amount);
      // shares = 500e18 / 5e18 = 100 (raw integer, not 18-decimal)
      expect(await escrow.sharesPurchased(investor1.address)).to.equal(BigInt(100));
      expect(await share.balanceOf(investor1.address)).to.equal(BigInt(100));
    });

    it("emits Deposited event", async function () {
      const amount = ethers.parseEther("500");
      await fdusd.connect(investor1).approve(await escrow.getAddress(), amount);
      await expect(escrow.connect(investor1).deposit(amount))
        .to.emit(escrow, "Deposited")
        .withArgs(investor1.address, amount, BigInt(100));
    });

    it("allows multiple deposits from same investor", async function () {
      const escrowAddr = await escrow.getAddress();
      await fdusd.connect(investor1).approve(escrowAddr, ethers.parseEther("1000"));
      await escrow.connect(investor1).deposit(ethers.parseEther("500"));
      await escrow.connect(investor1).deposit(ethers.parseEther("250"));

      expect(await escrow.deposits(investor1.address)).to.equal(ethers.parseEther("750"));
      expect(await escrow.sharesPurchased(investor1.address)).to.equal(BigInt(150));
    });

    it("reverts if not open", async function () {
      // Fast forward past deadline and trigger refund to change status
      const amount = ethers.parseEther("50");
      await fdusd.connect(investor1).approve(await escrow.getAddress(), amount);
      await escrow.connect(investor1).deposit(amount);
      await time.increaseTo(deadline);
      await escrow.triggerRefund();

      await fdusd.connect(investor2).approve(await escrow.getAddress(), amount);
      await expect(
        escrow.connect(investor2).deposit(amount)
      ).to.be.revertedWith("Not open");
    });

    it("reverts if deadline passed", async function () {
      await time.increaseTo(deadline);
      const amount = ethers.parseEther("500");
      await fdusd.connect(investor1).approve(await escrow.getAddress(), amount);
      await expect(
        escrow.connect(investor1).deposit(amount)
      ).to.be.revertedWith("Deadline passed");
    });

    it("reverts if exceeds max raise", async function () {
      const tooMuch = MAX_RAISE + ethers.parseEther("1");
      await fdusd.mint(investor1.address, tooMuch);
      await fdusd.connect(investor1).approve(await escrow.getAddress(), tooMuch);
      await expect(
        escrow.connect(investor1).deposit(tooMuch)
      ).to.be.revertedWith("Exceeds max raise");
    });
  });

  describe("release", function () {
    beforeEach(async function () {
      // Investor deposits 500 FDUSD (>= minRaise of 100)
      const amount = ethers.parseEther("500");
      await fdusd.connect(investor1).approve(await escrow.getAddress(), amount);
      await escrow.connect(investor1).deposit(amount);
    });

    it("releases funds to operator when min raise met", async function () {
      const balBefore = await fdusd.balanceOf(operator.address);
      await escrow.connect(operator).release();
      const balAfter = await fdusd.balanceOf(operator.address);

      expect(balAfter - balBefore).to.equal(ethers.parseEther("500"));
      expect(await escrow.status()).to.equal(BigInt(1)); // Funded
    });

    it("emits Released event", async function () {
      await expect(escrow.connect(operator).release())
        .to.emit(escrow, "Released")
        .withArgs(ethers.parseEther("500"));
    });

    it("reverts when called by non-owner", async function () {
      await expect(
        escrow.connect(investor1).release()
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });

    it("reverts when min raise not met", async function () {
      // Deploy fresh escrow with higher min raise
      const EscrowFactory = await ethers.getContractFactory("Escrow");
      const highMinEscrow = await EscrowFactory.deploy(
        await fdusd.getAddress(),
        await share.getAddress(),
        ethers.parseEther("99999"), // min raise higher than any deposit
        MAX_RAISE,
        PRICE_PER_SHARE,
        deadline,
        operator.address
      );
      await expect(
        highMinEscrow.connect(operator).release()
      ).to.be.revertedWith("Min raise not met");
    });

    it("reverts if already funded", async function () {
      await escrow.connect(operator).release();
      await expect(
        escrow.connect(operator).release()
      ).to.be.revertedWith("Not open");
    });
  });

  describe("triggerRefund", function () {
    beforeEach(async function () {
      // Small deposit below min raise
      const amount = ethers.parseEther("50");
      await fdusd.connect(investor1).approve(await escrow.getAddress(), amount);
      await escrow.connect(investor1).deposit(amount);
    });

    it("transitions to Refunding when deadline passed and min not met", async function () {
      await time.increaseTo(deadline);
      await escrow.triggerRefund();
      expect(await escrow.status()).to.equal(BigInt(2)); // Refunding
    });

    it("can be called by anyone", async function () {
      await time.increaseTo(deadline);
      await escrow.connect(other).triggerRefund();
      expect(await escrow.status()).to.equal(BigInt(2));
    });

    it("reverts if deadline not reached", async function () {
      await expect(escrow.triggerRefund()).to.be.revertedWith("Deadline not reached");
    });

    it("reverts if min raise is met", async function () {
      // Deposit enough to meet min raise
      const amount = ethers.parseEther("500");
      await fdusd.connect(investor2).approve(await escrow.getAddress(), amount);
      await escrow.connect(investor2).deposit(amount);

      await time.increaseTo(deadline);
      await expect(escrow.triggerRefund()).to.be.revertedWith("Min raise met");
    });

    it("reverts if not open", async function () {
      await time.increaseTo(deadline);
      await escrow.triggerRefund();
      await expect(escrow.triggerRefund()).to.be.revertedWith("Not open");
    });
  });

  describe("claimRefund", function () {
    const depositAmount = ethers.parseEther("500");
    // shares = 500e18 / 5e18 = 100 (raw integer, not 18-decimal)
    const expectedShares = BigInt(100);

    beforeEach(async function () {
      const escrowAddr = await escrow.getAddress();
      await fdusd.connect(investor1).approve(escrowAddr, depositAmount);
      await escrow.connect(investor1).deposit(depositAmount);

      // Also deposit from investor2
      await fdusd.connect(investor2).approve(escrowAddr, ethers.parseEther("250"));
      await escrow.connect(investor2).deposit(ethers.parseEther("250"));

      // Trigger refund (totalRaised = 750 < minRaise needs to be true)
      // Our minRaise is 100 and total is 750, so we need a different setup
      // Redeploy with higher minRaise
    });

    // Need a separate setup for refund scenario
    describe("with refund-eligible escrow", function () {
      let refundEscrow: Escrow;
      let refundShare: AgentShare;

      beforeEach(async function () {
        // Deploy separate contracts with high minRaise
        const ShareFactory = await ethers.getContractFactory("AgentShare");
        refundShare = await ShareFactory.deploy(
          "Refund Share", "RS", "agent-r", REVENUE_SHARE_BPS, TOTAL_SHARES, operator.address
        );
        await refundShare.waitForDeployment();

        const refundDeadline = (await time.latest()) + 3600;

        const EscrowFactory = await ethers.getContractFactory("Escrow");
        refundEscrow = await EscrowFactory.deploy(
          await fdusd.getAddress(),
          await refundShare.getAddress(),
          ethers.parseEther("10000"), // high minRaise
          MAX_RAISE,
          PRICE_PER_SHARE,
          refundDeadline,
          operator.address
        );
        await refundEscrow.waitForDeployment();

        // Transfer share ownership to escrow
        await refundShare.connect(operator).transferOwnership(await refundEscrow.getAddress());

        // Investor1 deposits 500
        await fdusd.connect(investor1).approve(await refundEscrow.getAddress(), depositAmount);
        await refundEscrow.connect(investor1).deposit(depositAmount);

        // Investor2 deposits 250
        await fdusd.connect(investor2).approve(await refundEscrow.getAddress(), ethers.parseEther("250"));
        await refundEscrow.connect(investor2).deposit(ethers.parseEther("250"));

        // Trigger refund
        await time.increaseTo(refundDeadline);
        await refundEscrow.triggerRefund();
      });

      it("returns FDUSD to investor", async function () {
        const balBefore = await fdusd.balanceOf(investor1.address);
        await refundEscrow.connect(investor1).claimRefund();
        const balAfter = await fdusd.balanceOf(investor1.address);
        expect(balAfter - balBefore).to.equal(depositAmount);
      });

      it("returns AgentShare tokens to the contract (bug fix)", async function () {
        // Before refund, investor holds shares
        expect(await refundShare.balanceOf(investor1.address)).to.equal(expectedShares);

        await refundEscrow.connect(investor1).claimRefund();

        // After refund, investor has zero shares
        expect(await refundShare.balanceOf(investor1.address)).to.equal(BigInt(0));

        // Shares returned to AgentShare contract
        const shareAddr = await refundShare.getAddress();
        // Contract balance should have increased by 100 shares
        // 50 raw shares still held by investor2 (250e18 / 5e18 = 50)
        expect(await refundShare.balanceOf(shareAddr)).to.equal(
          TOTAL_SHARES - BigInt(50)
        );
      });

      it("zeroes deposits and sharesPurchased", async function () {
        await refundEscrow.connect(investor1).claimRefund();
        expect(await refundEscrow.deposits(investor1.address)).to.equal(BigInt(0));
        expect(await refundEscrow.sharesPurchased(investor1.address)).to.equal(BigInt(0));
      });

      it("emits Refunded event", async function () {
        await expect(refundEscrow.connect(investor1).claimRefund())
          .to.emit(refundEscrow, "Refunded")
          .withArgs(investor1.address, depositAmount);
      });

      it("reverts if nothing to refund", async function () {
        await expect(
          refundEscrow.connect(other).claimRefund()
        ).to.be.revertedWith("Nothing to refund");
      });

      it("reverts if not in Refunding status", async function () {
        // Use the original escrow (still Open)
        await expect(
          escrow.connect(investor1).claimRefund()
        ).to.be.revertedWith("Not refunding");
      });

      it("allows multiple investors to claim refund independently", async function () {
        await refundEscrow.connect(investor1).claimRefund();
        await refundEscrow.connect(investor2).claimRefund();

        expect(await refundShare.balanceOf(investor1.address)).to.equal(BigInt(0));
        expect(await refundShare.balanceOf(investor2.address)).to.equal(BigInt(0));

        // All shares returned
        const shareAddr = await refundShare.getAddress();
        expect(await refundShare.balanceOf(shareAddr)).to.equal(TOTAL_SHARES);
      });
    });
  });
});
