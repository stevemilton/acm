import { expect } from "chai";
import { ethers } from "hardhat";
import { MockFDUSD } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("MockFDUSD", function () {
  let token: MockFDUSD;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  beforeEach(async function () {
    [deployer, alice, bob] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("MockFDUSD");
    token = await Factory.deploy();
    await token.waitForDeployment();
  });

  describe("constructor", function () {
    it("has correct name", async function () {
      expect(await token.name()).to.equal("ACM Mock FDUSD");
    });

    it("has correct symbol", async function () {
      expect(await token.symbol()).to.equal("mFDUSD");
    });

    it("starts with zero supply", async function () {
      expect(await token.totalSupply()).to.equal(BigInt(0));
    });
  });

  describe("mint", function () {
    it("mints tokens to the specified address", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(alice.address, amount);
      expect(await token.balanceOf(alice.address)).to.equal(amount);
    });

    it("increases total supply", async function () {
      const amount = ethers.parseEther("500");
      await token.mint(alice.address, amount);
      expect(await token.totalSupply()).to.equal(amount);
    });

    it("allows anyone to mint (public function)", async function () {
      const amount = ethers.parseEther("100");
      await token.connect(alice).mint(bob.address, amount);
      expect(await token.balanceOf(bob.address)).to.equal(amount);
    });
  });

  describe("transfer", function () {
    it("transfers tokens between accounts", async function () {
      const amount = ethers.parseEther("100");
      await token.mint(alice.address, amount);
      await token.connect(alice).transfer(bob.address, ethers.parseEther("40"));
      expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("60"));
      expect(await token.balanceOf(bob.address)).to.equal(ethers.parseEther("40"));
    });
  });

  describe("approve / transferFrom", function () {
    it("allows approved spender to transferFrom", async function () {
      const amount = ethers.parseEther("200");
      await token.mint(alice.address, amount);
      await token.connect(alice).approve(bob.address, amount);
      expect(await token.allowance(alice.address, bob.address)).to.equal(amount);

      await token.connect(bob).transferFrom(alice.address, bob.address, ethers.parseEther("50"));
      expect(await token.balanceOf(bob.address)).to.equal(ethers.parseEther("50"));
      expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("150"));
    });
  });
});
