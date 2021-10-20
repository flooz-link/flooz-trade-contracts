import chai, { expect } from "chai";
import { Contract, providers } from "ethers";
import { solidity, createFixtureLoader } from "ethereum-waffle";
import hre, { ethers, waffle } from "hardhat";

import { expandTo18Decimals, expandTo9Decimals } from "./shared/utilities";
import { v2Fixture } from "./shared/fixtures";

chai.use(solidity);

describe("FeeReceiver", () => {
  const [owner, wallet, revenueReceiver, godModeUser] = waffle.provider.getWallets();
  const loadFixture = createFixtureLoader([owner, revenueReceiver, godModeUser]);

  let token0: Contract;
  let token1: Contract;
  let WETH: Contract;
  let WETHPartner: Contract;
  let factory: Contract;
  let router: Contract;
  let feeReceiver: Contract;
  let pancakeRouterV2: Contract;

  beforeEach(async function () {
    const fixture = await loadFixture(v2Fixture);
    token0 = fixture.token0;
    token1 = fixture.token1;
    WETH = fixture.WETH;
    WETHPartner = fixture.WETHPartner;
    factory = fixture.factoryV2;
    router = fixture.router;
    pancakeRouterV2 = fixture.pancakeRouterV2;
    feeReceiver = fixture.feeReceiver;
  });

  describe("Unwrap WETH", () => {
    it("throws if contract has no WETH balance", async () => {
      await expect(feeReceiver.unwrapWETH()).to.be.revertedWith("FeeReceiver: Nothing to unwrap");
    });

    it("converts WETH > ETH", async () => {
      await WETH.deposit({ value: expandTo18Decimals(100) });
      expect(await ethers.provider.getBalance(feeReceiver.address)).to.eq(expandTo18Decimals(0));
      await WETH.transfer(feeReceiver.address, expandTo18Decimals(2));
      await feeReceiver.unwrapWETH();
      expect(await ethers.provider.getBalance(feeReceiver.address)).to.eq(expandTo18Decimals(2));
    });
  });

  describe("Admin functions", () => {
    it("only owner can withdraw ETH", async () => {
      await expect(feeReceiver.connect(wallet).withdrawETH(owner.address, expandTo18Decimals(2))).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      expect(await ethers.provider.getBalance(feeReceiver.address)).to.eq(ethers.utils.parseEther("2"));
      await feeReceiver.withdrawETH(owner.address, ethers.utils.parseEther("2"));
      expect(await ethers.provider.getBalance(feeReceiver.address)).to.eq(expandTo18Decimals(0));
    });

    it("only owner can withdraw Tokens", async () => {
      await expect(
        feeReceiver.connect(wallet).withdrawERC20Token(token0.address, wallet.address, 100)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      expect(await token0.balanceOf(wallet.address)).to.eq(expandTo9Decimals(0));

      await token0.transfer(feeReceiver.address, expandTo9Decimals(100));
      await feeReceiver.withdrawERC20Token(token0.address, wallet.address, expandTo9Decimals(100));
      expect(await token0.balanceOf(wallet.address)).to.eq(expandTo9Decimals(100));
    });
  });
});
