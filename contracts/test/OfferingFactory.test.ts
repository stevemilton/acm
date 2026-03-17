import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MockFDUSD, OfferingFactory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("OfferingFactory", function () {
  let fdusd: MockFDUSD;
  let factory: OfferingFactory;
  let owner: SignerWithAddress;
  let platformWallet: SignerWithAddress;
  let operatorA: SignerWithAddress;
  let operatorB: SignerWithAddress;
  let other: SignerWithAddress;

  beforeEach(async function () {
    [owner, platformWallet, operatorA, operatorB, other] = await ethers.getSigners();

    const FdusdFactory = await ethers.getContractFactory("MockFDUSD");
    fdusd = await FdusdFactory.deploy();
    await fdusd.waitForDeployment();

    const FactoryFactory = await ethers.getContractFactory("OfferingFactory");
    factory = await FactoryFactory.deploy(await fdusd.getAddress(), platformWallet.address);
    await factory.waitForDeployment();
  });

  describe("constructor", function () {
    it("sets payment token and platform wallet", async function () {
      expect(await factory.paymentToken()).to.equal(await fdusd.getAddress());
      expect(await factory.platformWallet()).to.equal(platformWallet.address);
    });

    it("sets deployer as owner", async function () {
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("starts with zero offerings", async function () {
      expect(await factory.totalOfferings()).to.equal(BigInt(0));
    });

    it("reverts with zero payment token", async function () {
      const F = await ethers.getContractFactory("OfferingFactory");
      await expect(
        F.deploy(ethers.ZeroAddress, platformWallet.address)
      ).to.be.revertedWith("Invalid payment token");
    });

    it("reverts with zero platform wallet", async function () {
      const F = await ethers.getContractFactory("OfferingFactory");
      await expect(
        F.deploy(await fdusd.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid platform wallet");
    });
  });

  describe("setApprovedOperator", function () {
    it("approves an operator (owner-only)", async function () {
      await factory.connect(owner).setApprovedOperator(operatorA.address, true);
      expect(await factory.approvedOperators(operatorA.address)).to.equal(true);
    });

    it("revokes operator approval", async function () {
      await factory.connect(owner).setApprovedOperator(operatorA.address, true);
      await factory.connect(owner).setApprovedOperator(operatorA.address, false);
      expect(await factory.approvedOperators(operatorA.address)).to.equal(false);
    });

    it("emits OperatorApproved event", async function () {
      await expect(factory.connect(owner).setApprovedOperator(operatorA.address, true))
        .to.emit(factory, "OperatorApproved")
        .withArgs(operatorA.address, true);
    });

    it("reverts when called by non-owner", async function () {
      await expect(
        factory.connect(operatorA).setApprovedOperator(operatorA.address, true)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });
  });

  describe("createOffering", function () {
    let params: any;
    let deadline: number;

    beforeEach(async function () {
      deadline = (await time.latest()) + 86400;
      params = {
        agentId: "agent-test-1",
        name: "Test Agent",
        symbol: "TAG",
        revenueShareBps: BigInt(1500),
        totalSupply: ethers.parseEther("10000"),
        minRaise: ethers.parseEther("100"),
        maxRaise: ethers.parseEther("50000"),
        pricePerShare: ethers.parseEther("5"),
        deadline: BigInt(deadline),
        operator: operatorA.address,
      };
    });

    it("creates offering when called by owner", async function () {
      await factory.connect(owner).createOffering(params);
      expect(await factory.totalOfferings()).to.equal(BigInt(1));
    });

    it("creates offering when called by approved operator", async function () {
      await factory.connect(owner).setApprovedOperator(operatorA.address, true);
      await factory.connect(operatorA).createOffering(params);
      expect(await factory.totalOfferings()).to.equal(BigInt(1));
    });

    it("reverts when called by non-approved address", async function () {
      await expect(
        factory.connect(other).createOffering(params)
      ).to.be.revertedWith("Not authorized");
    });

    it("reverts with zero operator address", async function () {
      params.operator = ethers.ZeroAddress;
      await expect(
        factory.connect(owner).createOffering(params)
      ).to.be.revertedWith("Invalid operator");
    });

    it("deploys 3 contracts with correct wiring", async function () {
      const tx = await factory.connect(owner).createOffering(params);
      const offering = await factory.getOffering(BigInt(0));

      // All addresses are non-zero
      expect(offering.agentShare).to.not.equal(ethers.ZeroAddress);
      expect(offering.escrow).to.not.equal(ethers.ZeroAddress);
      expect(offering.revenueDistributor).to.not.equal(ethers.ZeroAddress);
      expect(offering.agentId).to.equal("agent-test-1");
      expect(offering.operator).to.equal(operatorA.address);

      // AgentShare ownership transferred to Escrow
      const shareContract = await ethers.getContractAt("AgentShare", offering.agentShare);
      expect(await shareContract.owner()).to.equal(offering.escrow);

      // Escrow owned by operator
      const escrowContract = await ethers.getContractAt("Escrow", offering.escrow);
      expect(await escrowContract.owner()).to.equal(operatorA.address);

      // RevenueDistributor owned by operator
      const distContract = await ethers.getContractAt("RevenueDistributor", offering.revenueDistributor);
      expect(await distContract.owner()).to.equal(operatorA.address);
    });

    it("emits OfferingCreated event", async function () {
      const tx = await factory.connect(owner).createOffering(params);
      const receipt = await tx.wait();

      // Check the event was emitted (we can't easily predict addresses)
      const offering = await factory.getOffering(BigInt(0));
      await expect(tx)
        .to.emit(factory, "OfferingCreated")
        .withArgs(
          BigInt(0),
          "agent-test-1",
          offering.agentShare,
          offering.escrow,
          offering.revenueDistributor,
          operatorA.address
        );
    });

    it("auto-increments offering IDs", async function () {
      await factory.connect(owner).createOffering(params);

      params.agentId = "agent-test-2";
      await factory.connect(owner).createOffering(params);

      expect(await factory.totalOfferings()).to.equal(BigInt(2));
      const o0 = await factory.getOffering(BigInt(0));
      const o1 = await factory.getOffering(BigInt(1));
      expect(o0.agentId).to.equal("agent-test-1");
      expect(o1.agentId).to.equal("agent-test-2");
    });
  });

  describe("getOffering", function () {
    it("reverts for non-existent offering", async function () {
      await expect(
        factory.getOffering(BigInt(0))
      ).to.be.revertedWith("Offering does not exist");
    });
  });

  describe("totalOfferings", function () {
    it("returns count of offerings created", async function () {
      expect(await factory.totalOfferings()).to.equal(BigInt(0));

      const deadline = (await time.latest()) + 86400;
      const params = {
        agentId: "a1",
        name: "A",
        symbol: "A",
        revenueShareBps: BigInt(1000),
        totalSupply: ethers.parseEther("100"),
        minRaise: ethers.parseEther("10"),
        maxRaise: ethers.parseEther("100"),
        pricePerShare: ethers.parseEther("1"),
        deadline: BigInt(deadline),
        operator: operatorA.address,
      };
      await factory.connect(owner).createOffering(params);
      expect(await factory.totalOfferings()).to.equal(BigInt(1));
    });
  });
});
