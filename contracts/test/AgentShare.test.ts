import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentShare } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("AgentShare", function () {
  let token: AgentShare;
  let owner: SignerWithAddress;
  let investor: SignerWithAddress;
  let other: SignerWithAddress;

  const TOTAL_SUPPLY = ethers.parseEther("10000");
  const REVENUE_SHARE_BPS = BigInt(1500); // 15%

  beforeEach(async function () {
    [owner, investor, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AgentShare");
    token = await Factory.deploy(
      "Test Agent Share",
      "TAS",
      "agent-001",
      REVENUE_SHARE_BPS,
      TOTAL_SUPPLY,
      owner.address
    );
    await token.waitForDeployment();
  });

  describe("constructor", function () {
    it("sets correct name and symbol", async function () {
      expect(await token.name()).to.equal("Test Agent Share");
      expect(await token.symbol()).to.equal("TAS");
    });

    it("sets agentId", async function () {
      expect(await token.agentId()).to.equal("agent-001");
    });

    it("sets revenueShareBps", async function () {
      expect(await token.revenueShareBps()).to.equal(REVENUE_SHARE_BPS);
    });

    it("mints total supply to the contract itself", async function () {
      const contractAddr = await token.getAddress();
      expect(await token.balanceOf(contractAddr)).to.equal(TOTAL_SUPPLY);
      expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
    });

    it("starts with transfers disabled", async function () {
      expect(await token.transfersEnabled()).to.equal(false);
    });

    it("reverts if revenueShareBps is 0", async function () {
      const Factory = await ethers.getContractFactory("AgentShare");
      await expect(
        Factory.deploy("X", "X", "a", BigInt(0), TOTAL_SUPPLY, owner.address)
      ).to.be.revertedWith("Invalid revenue share");
    });

    it("reverts if revenueShareBps exceeds 5000", async function () {
      const Factory = await ethers.getContractFactory("AgentShare");
      await expect(
        Factory.deploy("X", "X", "a", BigInt(5001), TOTAL_SUPPLY, owner.address)
      ).to.be.revertedWith("Invalid revenue share");
    });

    it("allows revenueShareBps of exactly 5000", async function () {
      const Factory = await ethers.getContractFactory("AgentShare");
      const t = await Factory.deploy("X", "X", "a", BigInt(5000), TOTAL_SUPPLY, owner.address);
      expect(await t.revenueShareBps()).to.equal(BigInt(5000));
    });
  });

  describe("purchaseShares", function () {
    it("transfers shares from contract to investor (owner-only)", async function () {
      const amount = ethers.parseEther("100");
      await token.connect(owner).purchaseShares(investor.address, amount);
      expect(await token.balanceOf(investor.address)).to.equal(amount);
    });

    it("reverts when called by non-owner", async function () {
      await expect(
        token.connect(investor).purchaseShares(investor.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  describe("returnShares", function () {
    it("transfers shares from investor back to contract (owner-only)", async function () {
      const amount = ethers.parseEther("100");
      await token.connect(owner).purchaseShares(investor.address, amount);
      await token.connect(owner).returnShares(investor.address, amount);
      expect(await token.balanceOf(investor.address)).to.equal(BigInt(0));
      const contractAddr = await token.getAddress();
      expect(await token.balanceOf(contractAddr)).to.equal(TOTAL_SUPPLY);
    });

    it("reverts when called by non-owner", async function () {
      await token.connect(owner).purchaseShares(investor.address, ethers.parseEther("100"));
      await expect(
        token.connect(investor).returnShares(investor.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  describe("setTransfersEnabled", function () {
    it("toggles transfersEnabled (owner-only)", async function () {
      await token.connect(owner).setTransfersEnabled(true);
      expect(await token.transfersEnabled()).to.equal(true);
      await token.connect(owner).setTransfersEnabled(false);
      expect(await token.transfersEnabled()).to.equal(false);
    });

    it("reverts when called by non-owner", async function () {
      await expect(
        token.connect(investor).setTransfersEnabled(true)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("emits TransfersToggled event", async function () {
      await expect(token.connect(owner).setTransfersEnabled(true))
        .to.emit(token, "TransfersToggled")
        .withArgs(true);
    });
  });

  describe("_update override (transfer restrictions)", function () {
    beforeEach(async function () {
      await token.connect(owner).purchaseShares(investor.address, ethers.parseEther("100"));
    });

    it("blocks investor-to-investor transfer when transfers disabled", async function () {
      await expect(
        token.connect(investor).transfer(other.address, ethers.parseEther("10"))
      ).to.be.revertedWith("Transfers disabled");
    });

    it("allows investor-to-investor transfer when transfers enabled", async function () {
      await token.connect(owner).setTransfersEnabled(true);
      await token.connect(investor).transfer(other.address, ethers.parseEther("10"));
      expect(await token.balanceOf(other.address)).to.equal(ethers.parseEther("10"));
    });

    it("allows transfer TO contract address (return path) even when disabled", async function () {
      const contractAddr = await token.getAddress();
      // Investor can send tokens back to the contract directly
      await token.connect(investor).transfer(contractAddr, ethers.parseEther("10"));
      expect(await token.balanceOf(investor.address)).to.equal(ethers.parseEther("90"));
    });
  });
});
