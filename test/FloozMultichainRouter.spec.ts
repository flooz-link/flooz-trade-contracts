import chai, { expect } from "chai";
import { BigNumber, constants, Contract } from "ethers";
import { solidity, createFixtureLoader } from "ethereum-waffle";
import hre, { ethers, waffle } from "hardhat";

import { expandTo18Decimals, expandTo9Decimals } from "./shared/utilities";
import { v2Fixture } from "./shared/fixtures";
import { parseEther } from "@ethersproject/units";

chai.use(solidity);

const overrides = {
  gasLimit: 9999999,
};

describe("FloozMultichainRouter", () => {
  const [owner, wallet, user, godModeUser] = waffle.provider.getWallets();
  const loadFixture = createFixtureLoader([owner, user, godModeUser]);

  const FEE_NUMERATOR = BigNumber.from(50);
  const FEE_DENOMINATOR = BigNumber.from(10000);

  let token0: Contract;
  let token1: Contract;
  let WETH: Contract;
  let WETHPartner: Contract;
  let factory: Contract;
  let router: Contract;
  let pair: Contract;
  let WETHPair: Contract;
  let pancakeRouterV2: Contract;
  let DTT: Contract;
  let referralRegistry: Contract;
  let factoryV2: Contract;
  let feeReceiver: Contract;

  beforeEach(async function () {
    const fixture = await loadFixture(v2Fixture);
    token0 = fixture.token0;
    token1 = fixture.token1;
    WETH = fixture.WETH;
    WETHPartner = fixture.WETHPartner;
    factory = fixture.factoryV2;
    router = fixture.routerMultichain;
    pair = fixture.pair;
    WETHPair = fixture.WETHPair;
    pancakeRouterV2 = fixture.pancakeRouterV2;
    DTT = fixture.dtt;
    referralRegistry = fixture.referralRegistry;
    factoryV2 = fixture.factoryV2;
    feeReceiver = fixture.feeReceiver;

    hre.tracer.nameTags[owner.address] = "Owner";
    hre.tracer.nameTags[wallet.address] = "Wallet";
    hre.tracer.nameTags[pair.address] = "pair";
    hre.tracer.nameTags[token0.address] = "token0";
    hre.tracer.nameTags[token1.address] = "token1";
    hre.tracer.nameTags[router.address] = "floozRouter";
    hre.tracer.nameTags[pancakeRouterV2.address] = "pancakeRouterV2";
    hre.tracer.nameTags[WETHPair.address] = "WETHPair";
    hre.tracer.nameTags[WETH.address] = "WETH";
    hre.tracer.nameTags[WETHPartner.address] = "WETHPartner";
    hre.tracer.nameTags[godModeUser.address] = "godModeUser/Referee";
    hre.tracer.nameTags[feeReceiver.address] = "feeReceiver";
  });

  afterEach(async function () {
    expect(await ethers.provider.getBalance(router.address)).to.eq(ethers.constants.Zero);
  });

  async function addLiquidityTokenPair(token0Amount: BigNumber, token1Amount: BigNumber) {
    const liquidityBalance = await pair.balanceOf(owner.address);

    // burn existing liquidity, if minted earlier
    if (liquidityBalance.gt(BigNumber.from(0))) {
      await pair.transfer(pair.address, liquidityBalance);
      await pair.burn(owner.address);
    }

    const token0Bal = await token0.balanceOf(pair.address);
    const token1Bal = await token1.balanceOf(pair.address);
    await token0.transfer(pair.address, token0Amount.sub(token0Bal));
    await token1.transfer(pair.address, token1Amount.sub(token1Bal));
    await pair.mint(owner.address, overrides);
  }

  async function addLiquidityWETHPair(WETHPartnerAmount: BigNumber, ETHAmount: BigNumber) {
    const liquidityBalance = await WETHPair.balanceOf(owner.address);

    // burn existing liquidity, if minted earlier
    if (liquidityBalance.gt(BigNumber.from(0))) {
      await WETHPair.transfer(WETHPair.address, liquidityBalance);
      await WETHPair.burn(owner.address);
    }

    const tokenPartnerBal = await WETHPartner.balanceOf(WETHPair.address);
    const tokenWETHBal = await WETH.balanceOf(WETHPair.address);
    await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount.sub(tokenPartnerBal));
    await WETH.deposit({ value: ETHAmount });
    await WETH.transfer(WETHPair.address, ETHAmount.sub(tokenWETHBal));
    await WETHPair.mint(owner.address, overrides);
  }

  describe("Swaps", () => {
    describe("factory", () => {
      const swapAmount = expandTo18Decimals(1);

      it("cannot swap with invalid factory address", async () => {
        await expect(
          router.swapExactTokensForTokens(
            {
              fork: ethers.constants.AddressZero,
              referee: ethers.constants.AddressZero,
              fee: false,
            },
            swapAmount,
            0,
            [token0.address, token1.address],
            overrides
          )
        ).to.be.revertedWith("FloozRouter: INVALID_FACTORY");
      });
    });

    describe("swapExactTokensForTokens", () => {
      const token0Amount = expandTo18Decimals(1000000);
      const token1Amount = expandTo18Decimals(2000000);
      const swapAmount = expandTo18Decimals(1);
      const swapAmountAfterFee = swapAmount.sub(swapAmount.mul(FEE_NUMERATOR).div(FEE_DENOMINATOR));
      const feeAmount = swapAmount.mul(FEE_NUMERATOR).div(FEE_DENOMINATOR);
      const referralAmount = feeAmount.mul(1000).div(FEE_DENOMINATOR);
      const feeReceiverAmount = feeAmount.mul(9000).div(FEE_DENOMINATOR);
      const expectedOutputAmountgodModeUser = BigNumber.from("1994998009989485035");
      const expectedOutputAmount = BigNumber.from("1985023029839830096");
      const amountMin = BigNumber.from("1980000000000000000");
      let token0reserve: BigNumber, token1reserve: BigNumber;

      beforeEach(async () => {
        await addLiquidityTokenPair(token0Amount, token1Amount);
        await token0.approve(router.address, ethers.constants.MaxUint256);
        await token0.connect(user).approve(router.address, ethers.constants.MaxUint256);
        await token0.connect(godModeUser).approve(router.address, ethers.constants.MaxUint256);
      });

      it("happy path", async () => {
        await expect(
          router.connect(user).swapExactTokensForTokens(
            {
              fork: factory.address,
              referee: ethers.constants.AddressZero,
              fee: true,
            },
            swapAmount,
            amountMin,
            [token0.address, token1.address],
            overrides
          )
        )
          .to.emit(token0, "Transfer")
          .withArgs(user.address, pair.address, swapAmountAfterFee)
          .to.emit(token1, "Transfer")
          .withArgs(pair.address, user.address, expectedOutputAmount)
          .to.emit(token0, "Transfer")
          .withArgs(user.address, feeReceiver.address, feeAmount)
          .to.emit(pair, "Sync")
          .withArgs(token0Amount.add(swapAmountAfterFee), token1Amount.sub(expectedOutputAmount))
          .to.emit(pair, "Swap")
          .withArgs(router.address, swapAmountAfterFee, 0, 0, expectedOutputAmount, user.address);
      });

      it("referral", async () => {
        token0reserve = await token0.balanceOf(pair.address);
        token1reserve = await token1.balanceOf(pair.address);

        await expect(
          router.connect(user).swapExactTokensForTokens(
            {
              fork: factory.address,
              referee: godModeUser.address,
              fee: true,
            },
            swapAmount,
            amountMin,
            [token0.address, token1.address],
            overrides
          )
        )
          .to.emit(token0, "Transfer")
          .withArgs(user.address, pair.address, swapAmountAfterFee)
          .to.emit(token0, "Transfer")
          .withArgs(user.address, godModeUser.address, referralAmount)
          .to.emit(token0, "Transfer")
          .withArgs(user.address, feeReceiver.address, feeReceiverAmount)
          .to.emit(router, "ReferralRewardPaid")
          .withArgs(user.address, godModeUser.address, token1.address, token0.address, referralAmount)
          .to.emit(token1, "Transfer")
          .withArgs(pair.address, user.address, expectedOutputAmount)
          .to.emit(pair, "Sync")
          .withArgs(token0reserve.add(swapAmountAfterFee), token1reserve.sub(expectedOutputAmount))
          .to.emit(pair, "Swap")
          .withArgs(router.address, swapAmountAfterFee, 0, 0, expectedOutputAmount, user.address);
      });

      it("SYA holder â€“Â no fees", async () => {
        token0reserve = await token0.balanceOf(pair.address);
        token1reserve = await token1.balanceOf(pair.address);

        await expect(
          router.connect(godModeUser).swapExactTokensForTokens(
            {
              fork: factory.address,
              referee: ethers.constants.AddressZero,
              fee: false,
            },
            swapAmount,
            amountMin,
            [token0.address, token1.address],
            overrides
          )
        )
          .to.emit(token0, "Transfer")
          .withArgs(godModeUser.address, pair.address, swapAmount)
          .to.emit(token1, "Transfer")
          .withArgs(pair.address, godModeUser.address, expectedOutputAmountgodModeUser)
          .to.emit(pair, "Sync")
          .withArgs(token0reserve.add(swapAmount), token1reserve.sub(expectedOutputAmountgodModeUser))
          .to.emit(pair, "Swap")
          .withArgs(router.address, swapAmount, 0, 0, expectedOutputAmountgodModeUser, godModeUser.address);
      });
    });

    describe("swapTokensForExactTokens", () => {
      const token0Amount = expandTo18Decimals(1000000);
      const token1Amount = expandTo18Decimals(2000000);

      const outputAmount = BigNumber.from("1985023029839830096");
      const expectedInTotal = parseEther("1");
      const amountInMax = parseEther("1.05");
      const expectedSwapAmount = expectedInTotal.mul(FEE_DENOMINATOR.sub(FEE_NUMERATOR)).div(FEE_DENOMINATOR);
      const feeAmountTotal = expectedInTotal.mul(FEE_NUMERATOR).div(FEE_DENOMINATOR);
      const referralAmount = feeAmountTotal.mul(1000).div(FEE_DENOMINATOR);
      const feeReceiverAmount = feeAmountTotal.mul(9000).div(FEE_DENOMINATOR);

      let token0reserve: BigNumber, token1reserve: BigNumber;

      beforeEach(async () => {
        await addLiquidityTokenPair(token0Amount, token1Amount);
      });

      it("happy path", async () => {
        //reset referral
        await referralRegistry.updateReferralAnchor(user.address, constants.AddressZero);

        token0reserve = await token0.balanceOf(pair.address);
        token1reserve = await token1.balanceOf(pair.address);
        const balanceToken0Before = await token0.balanceOf(user.address);

        await token0.approve(router.address, ethers.constants.MaxUint256);
        await expect(
          router.connect(user).swapTokensForExactTokens(
            {
              fork: factory.address,
              referee: ethers.constants.AddressZero,
              fee: true,
            },
            outputAmount,
            amountInMax,
            [token0.address, token1.address],
            overrides
          )
        )
          .to.emit(token0, "Transfer")
          .withArgs(user.address, pair.address, expectedSwapAmount)
          .to.emit(token0, "Transfer")
          .withArgs(user.address, feeReceiver.address, feeAmountTotal)
          .to.emit(token1, "Transfer")
          .withArgs(pair.address, user.address, outputAmount)
          .to.emit(pair, "Sync")
          .withArgs(token0reserve.add(expectedSwapAmount), token1reserve.sub(outputAmount))
          .to.emit(pair, "Swap")
          .withArgs(router.address, expectedSwapAmount, 0, 0, outputAmount, user.address);

        expect(await token0.balanceOf(user.address)).to.be.equal(balanceToken0Before.sub(parseEther("1")));
      });

      it("referral", async () => {
        token0reserve = await token0.balanceOf(pair.address);
        token1reserve = await token1.balanceOf(pair.address);
        const balanceToken0Before = await token0.balanceOf(user.address);

        await token0.approve(router.address, ethers.constants.MaxUint256);
        await expect(
          router.connect(user).swapTokensForExactTokens(
            {
              fork: factory.address,
              referee: godModeUser.address,
              fee: true,
            },
            outputAmount,
            amountInMax,
            [token0.address, token1.address],
            overrides
          )
        )
          .to.emit(token0, "Transfer")
          .withArgs(user.address, pair.address, expectedSwapAmount)
          .to.emit(token1, "Transfer")
          .withArgs(pair.address, user.address, outputAmount)
          .to.emit(token0, "Transfer")
          .withArgs(user.address, feeReceiver.address, feeReceiverAmount)
          .to.emit(token0, "Transfer")
          .withArgs(user.address, godModeUser.address, referralAmount)
          .to.emit(pair, "Sync")
          .withArgs(token0reserve.add(expectedSwapAmount), token1reserve.sub(outputAmount))
          .to.emit(pair, "Swap")
          .withArgs(router.address, expectedSwapAmount, 0, 0, outputAmount, user.address);

        expect(await token0.balanceOf(user.address)).to.be.equal(balanceToken0Before.sub(parseEther("1")));
      });

      it("SYA holder â€“ no fees", async () => {
        const balanceToken0Before = await token0.balanceOf(owner.address);

        token0reserve = await token0.balanceOf(pair.address);
        token1reserve = await token1.balanceOf(pair.address);
        await referralRegistry.updateReferralAnchor(owner.address, constants.AddressZero);
        await token0.approve(router.address, ethers.constants.MaxUint256);
        await expect(
          router.swapTokensForExactTokens(
            {
              fork: factory.address,
              referee: constants.AddressZero,
              fee: false,
            },
            outputAmount,
            amountInMax,
            [token0.address, token1.address],
            overrides
          )
        )
          .to.emit(token0, "Transfer")
          .withArgs(owner.address, pair.address, expectedSwapAmount)
          .to.emit(token1, "Transfer")
          .withArgs(pair.address, owner.address, outputAmount)
          .to.emit(pair, "Sync")
          .withArgs(token0reserve.add(expectedSwapAmount), token1reserve.sub(outputAmount))
          .to.emit(pair, "Swap")
          .withArgs(router.address, expectedSwapAmount, 0, 0, outputAmount, owner.address);

        expect(await token0.balanceOf(owner.address)).to.be.equal(balanceToken0Before.sub(parseEther("0.995")));
      });
    });

    describe("swapTokensForExactETH", () => {
      const WETHPartnerAmount = expandTo18Decimals(1000);
      const ETHAmount = expandTo18Decimals(2000);
      const expectedSwapAmount = BigNumber.from("501503884774467435");
      const expectedSwapAmountGodMode = BigNumber.from("498995117238746076");
      const outputAmount = parseEther("0.995");
      const outputAmountWithFee = outputAmount.mul(FEE_DENOMINATOR).div(FEE_DENOMINATOR.sub(FEE_NUMERATOR));
      let WETHPartnerReserve: BigNumber, WETHReserve: BigNumber;

      beforeEach(async () => {
        await addLiquidityWETHPair(WETHPartnerAmount, ETHAmount);
      });

      it("happy path", async () => {
        //reset referral
        await referralRegistry.updateReferralAnchor(user.address, constants.AddressZero);
        let WETHPartnerReserve = await WETHPartner.balanceOf(WETHPair.address);
        let WETHReserve = await WETH.balanceOf(WETHPair.address);

        await WETHPartner.approve(router.address, ethers.constants.MaxUint256);
        await WETHPartner.connect(user).approve(router.address, ethers.constants.MaxUint256);
        const WETHPairToken0 = await WETHPair.token0();

        let balanceBefore = await ethers.provider.getBalance(user.address);
        await expect(
          router.connect(user).swapTokensForExactETH(
            {
              fork: factory.address,
              referee: constants.AddressZero,
              fee: true,
            },
            outputAmount,
            ethers.constants.MaxUint256,
            [WETHPartner.address, WETH.address],
            overrides
          )
        )
          .to.emit(WETHPartner, "Transfer")
          .withArgs(user.address, WETHPair.address, expectedSwapAmount)
          .to.emit(WETH, "Transfer")
          .withArgs(WETHPair.address, router.address, outputAmountWithFee)
          .to.emit(WETHPair, "Sync")
          .withArgs(
            WETHPairToken0 === WETHPartner.address
              ? WETHPartnerReserve.add(expectedSwapAmount)
              : WETHReserve.sub(outputAmountWithFee),
            WETHPairToken0 === WETHPartner.address
              ? WETHReserve.sub(outputAmountWithFee)
              : WETHPartnerReserve.add(expectedSwapAmount)
          )
          .to.emit(WETHPair, "Swap")
          .withArgs(
            router.address,
            WETHPairToken0 === WETHPartner.address ? expectedSwapAmount : 0,
            WETHPairToken0 === WETHPartner.address ? 0 : expectedSwapAmount,
            WETHPairToken0 === WETHPartner.address ? 0 : outputAmountWithFee,
            WETHPairToken0 === WETHPartner.address ? outputAmountWithFee : 0,
            router.address
          );
      });

      it("referral", async () => {
        let WETHPartnerReserve = await WETHPartner.balanceOf(WETHPair.address);
        let WETHReserve = await WETH.balanceOf(WETHPair.address);

        await WETHPartner.approve(router.address, ethers.constants.MaxUint256);
        await WETHPartner.connect(user).approve(router.address, ethers.constants.MaxUint256);
        const WETHPairToken0 = await WETHPair.token0();

        let feeBalanceBefore = await ethers.provider.getBalance(feeReceiver.address);
        await expect(
          router.connect(user).swapTokensForExactETH(
            {
              fork: factory.address,
              referee: godModeUser.address,
              fee: true,
            },
            outputAmount,
            ethers.constants.MaxUint256,
            [WETHPartner.address, WETH.address],
            overrides
          )
        )
          .to.emit(WETHPartner, "Transfer")
          .withArgs(user.address, WETHPair.address, expectedSwapAmount)
          .to.emit(WETH, "Transfer")
          .withArgs(WETHPair.address, router.address, outputAmountWithFee)
          .to.emit(router, "ReferralRewardPaid")
          .withArgs(user.address, godModeUser.address, WETH.address, constants.AddressZero, parseEther("0.0005"))
          .to.emit(WETHPair, "Sync")
          .withArgs(
            WETHPairToken0 === WETHPartner.address
              ? WETHPartnerReserve.add(expectedSwapAmount)
              : WETHReserve.sub(outputAmountWithFee),
            WETHPairToken0 === WETHPartner.address
              ? WETHReserve.sub(outputAmountWithFee)
              : WETHPartnerReserve.add(expectedSwapAmount)
          )
          .to.emit(WETHPair, "Swap")
          .withArgs(
            router.address,
            WETHPairToken0 === WETHPartner.address ? expectedSwapAmount : 0,
            WETHPairToken0 === WETHPartner.address ? 0 : expectedSwapAmount,
            WETHPairToken0 === WETHPartner.address ? 0 : outputAmountWithFee,
            WETHPairToken0 === WETHPartner.address ? outputAmountWithFee : 0,
            router.address
          );

        let feeBalanceAfter = await ethers.provider.getBalance(feeReceiver.address);
        expect(feeBalanceAfter).to.be.equal(feeBalanceBefore.add(parseEther("0.0045")));
      });

      it("SYA Holder â€“Â no fee", async () => {
        let WETHPartnerReserve = await WETHPartner.balanceOf(WETHPair.address);
        let WETHReserve = await WETH.balanceOf(WETHPair.address);

        await WETHPartner.approve(router.address, ethers.constants.MaxUint256);
        await WETHPartner.connect(godModeUser).approve(router.address, ethers.constants.MaxUint256);
        const WETHPairToken0 = await WETHPair.token0();

        let feeBalanceBefore = await ethers.provider.getBalance(feeReceiver.address);
        await expect(
          router.connect(godModeUser).swapTokensForExactETH(
            {
              fork: factory.address,
              referee: constants.AddressZero,
              fee: false,
            },
            outputAmount,
            ethers.constants.MaxUint256,
            [WETHPartner.address, WETH.address],
            overrides
          )
        )
          .to.emit(WETHPartner, "Transfer")
          .withArgs(godModeUser.address, WETHPair.address, expectedSwapAmountGodMode)
          .to.emit(WETH, "Transfer")
          .withArgs(WETHPair.address, router.address, outputAmount)
          .to.emit(WETHPair, "Sync")
          .withArgs(
            WETHPairToken0 === WETHPartner.address
              ? WETHPartnerReserve.add(expectedSwapAmountGodMode)
              : WETHReserve.sub(outputAmount),
            WETHPairToken0 === WETHPartner.address
              ? WETHReserve.sub(outputAmount)
              : WETHPartnerReserve.add(expectedSwapAmountGodMode)
          )
          .to.emit(WETHPair, "Swap")
          .withArgs(
            router.address,
            WETHPairToken0 === WETHPartner.address ? expectedSwapAmountGodMode : 0,
            WETHPairToken0 === WETHPartner.address ? 0 : expectedSwapAmountGodMode,
            WETHPairToken0 === WETHPartner.address ? 0 : outputAmount,
            WETHPairToken0 === WETHPartner.address ? outputAmount : 0,
            router.address
          );

        let feeBalanceAfter = await ethers.provider.getBalance(feeReceiver.address);
        expect(feeBalanceAfter).to.be.equal(feeBalanceBefore);
      });
    });

    describe("swapExactTokensForETH", () => {
      const WETHPartnerAmount = expandTo18Decimals(1000);
      const ETHAmount = expandTo18Decimals(2000);
      const swapAmount = BigNumber.from("501503884774467435");
      const expectedOutputAmount = BigNumber.from("1000000000000000001");

      beforeEach(async () => {
        await addLiquidityWETHPair(WETHPartnerAmount, ETHAmount);
      });

      it("happy path", async () => {
        //reset referral
        await referralRegistry.updateReferralAnchor(user.address, constants.AddressZero);

        let WETHPartnerReserve = await WETHPartner.balanceOf(WETHPair.address);
        let WETHReserve = await WETH.balanceOf(WETHPair.address);

        await WETHPartner.approve(router.address, ethers.constants.MaxUint256);
        const WETHPairToken0 = await WETHPair.token0();
        await expect(
          router.connect(user).swapExactTokensForETH(
            {
              fork: factory.address,
              referee: constants.AddressZero,
              fee: true,
            },
            swapAmount,
            0,
            [WETHPartner.address, WETH.address],
            overrides
          )
        )
          .to.emit(WETHPartner, "Transfer")
          .withArgs(user.address, WETHPair.address, swapAmount)
          .to.emit(WETH, "Transfer")
          .withArgs(WETHPair.address, router.address, expectedOutputAmount)
          .to.emit(WETHPair, "Sync")
          .withArgs(
            WETHPairToken0 === WETHPartner.address
              ? WETHPartnerReserve.add(swapAmount)
              : WETHReserve.sub(expectedOutputAmount),
            WETHPairToken0 === WETHPartner.address
              ? WETHReserve.sub(expectedOutputAmount)
              : WETHPartnerReserve.add(swapAmount)
          )
          .to.emit(WETHPair, "Swap")
          .withArgs(
            router.address,
            WETHPairToken0 === WETHPartner.address ? swapAmount : 0,
            WETHPairToken0 === WETHPartner.address ? 0 : swapAmount,
            WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
            WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
            router.address
          );
      });

      it("referral", async () => {
        let WETHPartnerReserve = await WETHPartner.balanceOf(WETHPair.address);
        let WETHReserve = await WETH.balanceOf(WETHPair.address);

        await WETHPartner.approve(router.address, ethers.constants.MaxUint256);
        const WETHPairToken0 = await WETHPair.token0();
        await expect(
          router.connect(user).swapExactTokensForETH(
            {
              fork: factory.address,
              referee: godModeUser.address,
              fee: true,
            },
            swapAmount,
            0,
            [WETHPartner.address, WETH.address],
            overrides
          )
        )
          .to.emit(WETHPartner, "Transfer")
          .withArgs(user.address, WETHPair.address, swapAmount)
          .to.emit(WETH, "Transfer")
          .withArgs(WETHPair.address, router.address, expectedOutputAmount)
          .to.emit(router, "ReferralRewardPaid")
          .withArgs(user.address, godModeUser.address, WETH.address, constants.AddressZero, parseEther("0.0005"))
          .to.emit(WETHPair, "Sync")
          .withArgs(
            WETHPairToken0 === WETHPartner.address
              ? WETHPartnerReserve.add(swapAmount)
              : WETHReserve.sub(expectedOutputAmount),
            WETHPairToken0 === WETHPartner.address
              ? WETHReserve.sub(expectedOutputAmount)
              : WETHPartnerReserve.add(swapAmount)
          )
          .to.emit(WETHPair, "Swap")
          .withArgs(
            router.address,
            WETHPairToken0 === WETHPartner.address ? swapAmount : 0,
            WETHPairToken0 === WETHPartner.address ? 0 : swapAmount,
            WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
            WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
            router.address
          );
      });

      it("SYA holder â€“Â no fees", async () => {
        let WETHPartnerReserve = await WETHPartner.balanceOf(WETHPair.address);
        let WETHReserve = await WETH.balanceOf(WETHPair.address);

        let feeBalanceBefore = await ethers.provider.getBalance(feeReceiver.address);

        await WETHPartner.connect(godModeUser).approve(router.address, ethers.constants.MaxUint256);
        const WETHPairToken0 = await WETHPair.token0();
        await expect(
          router.connect(godModeUser).swapExactTokensForETH(
            {
              fork: factory.address,
              referee: constants.AddressZero,
              fee: false,
            },
            swapAmount,
            0,
            [WETHPartner.address, WETH.address],
            overrides
          )
        )
          .to.emit(WETHPartner, "Transfer")
          .withArgs(godModeUser.address, WETHPair.address, swapAmount)
          .to.emit(WETH, "Transfer")
          .withArgs(WETHPair.address, router.address, expectedOutputAmount)
          .to.emit(WETHPair, "Sync")
          .withArgs(
            WETHPairToken0 === WETHPartner.address
              ? WETHPartnerReserve.add(swapAmount)
              : WETHReserve.sub(expectedOutputAmount),
            WETHPairToken0 === WETHPartner.address
              ? WETHReserve.sub(expectedOutputAmount)
              : WETHPartnerReserve.add(swapAmount)
          )
          .to.emit(WETHPair, "Swap")
          .withArgs(
            router.address,
            WETHPairToken0 === WETHPartner.address ? swapAmount : 0,
            WETHPairToken0 === WETHPartner.address ? 0 : swapAmount,
            WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
            WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
            router.address
          );

        let feeBalanceAfter = await ethers.provider.getBalance(feeReceiver.address);
        expect(feeBalanceBefore).to.be.equal(feeBalanceAfter);
      });
    });

    describe("swapExactETHForTokens", () => {
      const WETHPartnerAmount = expandTo18Decimals(1000);
      const ETHAmount = expandTo18Decimals(2000);
      const swapAmount = expandTo18Decimals(1);
      const swapAmountAfterFee = ethers.utils.parseEther("0.995");
      const referralReward = ethers.utils.parseEther("0.0005");
      const expectedOutputAmount = BigNumber.from("496010101886875501");
      const expectedOutputAmountGodMode = BigNumber.from("498501372440495302");

      beforeEach(async () => {
        await addLiquidityWETHPair(WETHPartnerAmount, ETHAmount);
      });

      it("happy path", async () => {
        await referralRegistry.updateReferralAnchor(user.address, constants.AddressZero);
        let feeBalanceBefore = await ethers.provider.getBalance(feeReceiver.address);

        const WETHPairToken0 = await WETHPair.token0();
        await expect(
          router.connect(user).swapExactETHForTokens(
            {
              fork: factory.address,
              referee: constants.AddressZero,
              fee: true,
            },
            0,
            [WETH.address, WETHPartner.address],
            {
              ...overrides,
              value: swapAmount,
            }
          )
        )
          .to.emit(WETH, "Transfer")
          .withArgs(router.address, WETHPair.address, swapAmountAfterFee)
          .to.emit(WETHPartner, "Transfer")
          .withArgs(WETHPair.address, user.address, expectedOutputAmount)
          .to.emit(WETHPair, "Sync")
          .withArgs(
            WETHPairToken0 === WETHPartner.address
              ? WETHPartnerAmount.sub(expectedOutputAmount)
              : ETHAmount.add(swapAmountAfterFee),
            WETHPairToken0 === WETHPartner.address
              ? ETHAmount.add(swapAmountAfterFee)
              : WETHPartnerAmount.sub(expectedOutputAmount)
          )
          .to.emit(WETHPair, "Swap")
          .withArgs(
            router.address,
            WETHPairToken0 === WETHPartner.address ? 0 : swapAmountAfterFee,
            WETHPairToken0 === WETHPartner.address ? swapAmountAfterFee : 0,
            WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
            WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
            user.address
          );

        let feeBalanceAfter = await ethers.provider.getBalance(feeReceiver.address);
        expect(feeBalanceAfter).to.be.equal(feeBalanceBefore.add(parseEther("0.005")));
      });

      it("referral", async () => {
        let WETHPartnerReserve = await WETHPartner.balanceOf(WETHPair.address);
        let WETHReserve = await WETH.balanceOf(WETHPair.address);
        const WETHPairToken0 = await WETHPair.token0();
        const expectedOutputAmount = BigNumber.from("496010101886875501");

        await expect(
          router.connect(user).swapExactETHForTokens(
            {
              fork: factory.address,
              referee: godModeUser.address,
              fee: true,
            },
            0,
            [WETH.address, WETHPartner.address],
            {
              ...overrides,
              value: swapAmount,
            }
          )
        )
          .to.emit(WETH, "Transfer")
          .withArgs(router.address, WETHPair.address, swapAmountAfterFee)
          .to.emit(WETHPartner, "Transfer")
          .withArgs(WETHPair.address, user.address, expectedOutputAmount)
          .to.emit(router, "ReferralRewardPaid")
          .withArgs(
            user.address,
            godModeUser.address,
            WETHPartner.address,
            ethers.constants.AddressZero,
            referralReward
          )
          .to.emit(WETHPair, "Sync")
          .withArgs(
            WETHPairToken0 === WETHPartner.address
              ? WETHPartnerReserve.sub(expectedOutputAmount)
              : WETHReserve.add(swapAmountAfterFee),
            WETHPairToken0 === WETHPartner.address
              ? WETHReserve.add(swapAmountAfterFee)
              : WETHPartnerReserve.sub(expectedOutputAmount)
          )
          .to.emit(WETHPair, "Swap")
          .withArgs(
            router.address,
            WETHPairToken0 === WETHPartner.address ? 0 : swapAmountAfterFee,
            WETHPairToken0 === WETHPartner.address ? swapAmountAfterFee : 0,
            WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
            WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
            user.address
          );
      });

      it("SYA Holder â€“Â no fees", async () => {
        const WETHPairToken0 = await WETHPair.token0();
        await expect(
          router.connect(godModeUser).swapExactETHForTokens(
            {
              fork: factory.address,
              referee: ethers.constants.AddressZero,
              fee: false,
            },
            0,
            [WETH.address, WETHPartner.address],
            {
              ...overrides,
              value: swapAmount,
            }
          )
        )
          .to.emit(WETH, "Transfer")
          .withArgs(router.address, WETHPair.address, swapAmount)
          .to.emit(WETHPartner, "Transfer")
          .withArgs(WETHPair.address, godModeUser.address, expectedOutputAmountGodMode)
          .to.emit(WETHPair, "Sync")
          .withArgs(
            WETHPairToken0 === WETHPartner.address
              ? WETHPartnerAmount.sub(expectedOutputAmountGodMode)
              : ETHAmount.add(swapAmount),
            WETHPairToken0 === WETHPartner.address
              ? ETHAmount.add(swapAmount)
              : WETHPartnerAmount.sub(expectedOutputAmountGodMode)
          )
          .to.emit(WETHPair, "Swap")
          .withArgs(
            router.address,
            WETHPairToken0 === WETHPartner.address ? 0 : swapAmount,
            WETHPairToken0 === WETHPartner.address ? swapAmount : 0,
            WETHPairToken0 === WETHPartner.address ? expectedOutputAmountGodMode : 0,
            WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmountGodMode,
            godModeUser.address
          );
      });
    });

    describe("swapETHForExactTokens", () => {
      const WETHPartnerAmount = expandTo18Decimals(1000);
      const ETHAmount = expandTo18Decimals(2000);
      const outputAmount = BigNumber.from("496010101886875501");
      const expectedSwapAmount = parseEther("1");
      const inputAmountAfterFee = parseEther("0.995");
      const referralReward = parseEther("0.0005");

      beforeEach(async () => {
        await addLiquidityWETHPair(WETHPartnerAmount, ETHAmount);
      });

      it("happy path ", async () => {
        //reset referral
        await referralRegistry.updateReferralAnchor(user.address, constants.AddressZero);

        let WETHPartnerReserve = await WETHPartner.balanceOf(WETHPair.address);
        let WETHReserve = await WETH.balanceOf(WETHPair.address);

        const WETHPairToken0 = await WETHPair.token0();
        let feeBalanceBefore = await ethers.provider.getBalance(feeReceiver.address);

        await expect(
          router.connect(user).swapETHForExactTokens(
            {
              fork: factory.address,
              referee: ethers.constants.AddressZero,
              fee: true,
            },
            outputAmount,
            [WETH.address, WETHPartner.address],
            {
              ...overrides,
              value: expectedSwapAmount.add(3), // should send back the dust
            }
          )
        )
          .to.emit(WETH, "Transfer")
          .withArgs(router.address, WETHPair.address, inputAmountAfterFee)
          .to.emit(WETHPartner, "Transfer")
          .withArgs(WETHPair.address, user.address, outputAmount)

          .to.emit(WETHPair, "Sync")
          .withArgs(
            WETHPairToken0 === WETHPartner.address
              ? WETHPartnerReserve.sub(outputAmount)
              : WETHReserve.add(inputAmountAfterFee),
            WETHPairToken0 === WETHPartner.address
              ? WETHReserve.add(inputAmountAfterFee)
              : WETHPartnerReserve.sub(outputAmount)
          )
          .to.emit(WETHPair, "Swap")
          .withArgs(
            router.address,
            WETHPairToken0 === WETHPartner.address ? 0 : inputAmountAfterFee,
            WETHPairToken0 === WETHPartner.address ? inputAmountAfterFee : 0,
            WETHPairToken0 === WETHPartner.address ? outputAmount : 0,
            WETHPairToken0 === WETHPartner.address ? 0 : outputAmount,
            user.address
          );

        let feeBalanceAfter = await ethers.provider.getBalance(feeReceiver.address);
        expect(feeBalanceAfter).to.be.equal(feeBalanceBefore.add(parseEther("0.005")));
      });

      it("referral", async () => {
        let WETHPartnerReserve = await WETHPartner.balanceOf(WETHPair.address);
        let WETHReserve = await WETH.balanceOf(WETHPair.address);

        const WETHPairToken0 = await WETHPair.token0();
        let feeBalanceBefore = await ethers.provider.getBalance(feeReceiver.address);

        await expect(
          router.connect(user).swapETHForExactTokens(
            {
              fork: factory.address,
              referee: godModeUser.address,
              fee: true,
            },
            outputAmount,
            [WETH.address, WETHPartner.address],
            {
              ...overrides,
              value: expectedSwapAmount,
            }
          )
        )
          .to.emit(WETH, "Transfer")
          .withArgs(router.address, WETHPair.address, inputAmountAfterFee)
          .to.emit(WETHPartner, "Transfer")
          .withArgs(WETHPair.address, user.address, outputAmount)
          .to.emit(router, "ReferralRewardPaid")
          .withArgs(
            user.address,
            godModeUser.address,
            WETHPartner.address,
            ethers.constants.AddressZero,
            referralReward
          )
          .to.emit(WETHPair, "Sync")
          .withArgs(
            WETHPairToken0 === WETHPartner.address
              ? WETHPartnerReserve.sub(outputAmount)
              : WETHReserve.add(inputAmountAfterFee),
            WETHPairToken0 === WETHPartner.address
              ? WETHReserve.add(inputAmountAfterFee)
              : WETHPartnerReserve.sub(outputAmount)
          )
          .to.emit(WETHPair, "Swap")
          .withArgs(
            router.address,
            WETHPairToken0 === WETHPartner.address ? 0 : inputAmountAfterFee,
            WETHPairToken0 === WETHPartner.address ? inputAmountAfterFee : 0,
            WETHPairToken0 === WETHPartner.address ? outputAmount : 0,
            WETHPairToken0 === WETHPartner.address ? 0 : outputAmount,
            user.address
          );

        let feeBalanceAfter = await ethers.provider.getBalance(feeReceiver.address);
        expect(feeBalanceAfter).to.be.equal(feeBalanceBefore.add(parseEther("0.0045")));
      });

      it("SYA Holder - no fees", async () => {
        let WETHPartnerReserve = await WETHPartner.balanceOf(WETHPair.address);
        let WETHReserve = await WETH.balanceOf(WETHPair.address);

        const WETHPairToken0 = await WETHPair.token0();
        let feeBalanceBefore = await ethers.provider.getBalance(feeReceiver.address);

        await expect(
          router.connect(godModeUser).swapETHForExactTokens(
            {
              fork: factory.address,
              referee: constants.AddressZero,
              fee: false,
            },
            outputAmount,
            [WETH.address, WETHPartner.address],
            {
              ...overrides,
              value: inputAmountAfterFee,
            }
          )
        )
          .to.emit(WETH, "Transfer")
          .withArgs(router.address, WETHPair.address, inputAmountAfterFee)
          .to.emit(WETHPartner, "Transfer")
          .withArgs(WETHPair.address, godModeUser.address, outputAmount)
          .to.emit(WETHPair, "Sync")
          .withArgs(
            WETHPairToken0 === WETHPartner.address
              ? WETHPartnerReserve.sub(outputAmount)
              : WETHReserve.add(inputAmountAfterFee),
            WETHPairToken0 === WETHPartner.address
              ? WETHReserve.add(inputAmountAfterFee)
              : WETHPartnerReserve.sub(outputAmount)
          )
          .to.emit(WETHPair, "Swap")
          .withArgs(
            router.address,
            WETHPairToken0 === WETHPartner.address ? 0 : inputAmountAfterFee,
            WETHPairToken0 === WETHPartner.address ? inputAmountAfterFee : 0,
            WETHPairToken0 === WETHPartner.address ? outputAmount : 0,
            WETHPairToken0 === WETHPartner.address ? 0 : outputAmount,
            godModeUser.address
          );

        let feeBalanceAfter = await ethers.provider.getBalance(feeReceiver.address);
        expect(feeBalanceAfter).to.be.equal(feeBalanceBefore);
      });
    });
  });

  describe("Swaps Supporting Fees", () => {
    async function addLiquidity(DTTAmount: BigNumber, ETHAmount: BigNumber) {
      await DTT.approve(pancakeRouterV2.address, ethers.constants.MaxUint256);
      console.log(pancakeRouterV2.address);
      await pancakeRouterV2.addLiquidityETH(
        DTT.address,
        DTTAmount,
        0,
        ETHAmount,
        wallet.address,
        ethers.constants.MaxUint256,
        {
          value: ETHAmount,
        }
      );
    }

    describe("swapExactTokensForETHSupportingFeeOnTransferTokens", () => {
      const swapAmount = expandTo18Decimals(1);

      beforeEach(async () => {
        await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100));
      });

      it("happy path ", async () => {
        //reset referral
        await referralRegistry.updateReferralAnchor(user.address, constants.AddressZero);
        await DTT.connect(user).approve(router.address, ethers.constants.MaxUint256);
        await router.connect(user).swapExactTokensForETHSupportingFeeOnTransferTokens(
          {
            fork: factory.address,
            referee: constants.AddressZero,
            fee: true,
          },
          swapAmount,
          0,
          [DTT.address, WETH.address],
          overrides
        );

        await router.connect(user).swapExactTokensForETHSupportingFeeOnTransferTokens(
          {
            fork: factory.address,
            referee: godModeUser.address,
            fee: true,
          },
          swapAmount,
          0,
          [DTT.address, WETH.address],
          overrides
        );
      });
    });

    describe("swapExactETHForTokensSupportingFeeOnTransferTokens", () => {
      const swapAmount = expandTo18Decimals(1);
      const amountOutMin = BigNumber.from("525808795773767893");

      beforeEach(async () => {
        await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(9));
      });

      it("happy path ", async () => {
        //reset referral
        await referralRegistry.updateReferralAnchor(user.address, constants.AddressZero);

        await router.connect(user).swapExactETHForTokensSupportingFeeOnTransferTokens(
          {
            fork: factory.address,
            referee: ethers.constants.AddressZero,
            fee: true,
          },
          amountOutMin,
          [WETH.address, DTT.address],
          {
            value: swapAmount,
          }
        );

        await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
          {
            fork: factory.address,
            referee: godModeUser.address,
            fee: true,
          },
          amountOutMin,
          [WETH.address, DTT.address],
          {
            value: swapAmount,
          }
        );
      });
    });

    describe("swapExactTokensForTokensSupportingFeeOnTransferTokens", () => {
      const swapAmount = expandTo18Decimals(1);

      beforeEach(async () => {
        await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(9));
      });

      it("happy path", async () => {
        //reset referral
        await referralRegistry.updateReferralAnchor(user.address, constants.AddressZero);

        await DTT.connect(user).approve(router.address, ethers.constants.MaxUint256);
        await router.connect(user).swapExactTokensForTokensSupportingFeeOnTransferTokens(
          {
            fork: factory.address,
            referee: ethers.constants.AddressZero,
            fee: true,
          },
          swapAmount,
          0,
          [DTT.address, WETH.address],
          overrides
        );

        await router.connect(user).swapExactTokensForTokensSupportingFeeOnTransferTokens(
          {
            fork: factory.address,
            referee: godModeUser.address,
            fee: true,
          },
          swapAmount,
          0,
          [DTT.address, WETH.address],
          overrides
        );
      });
    });
  });

  describe("Custom Referral Rate", () => {
    const token0Amount = expandTo18Decimals(1000000);
    const token1Amount = expandTo18Decimals(2000000);
    const swapAmount = expandTo18Decimals(1);
    const swapAmountAfterFee = swapAmount.sub(swapAmount.mul(FEE_NUMERATOR).div(FEE_DENOMINATOR));
    const feeAmount = swapAmount.mul(FEE_NUMERATOR).div(FEE_DENOMINATOR);
    const referralReward = feeAmount.mul(1000).div(FEE_DENOMINATOR);
    let token0reserve: BigNumber, token1reserve: BigNumber;

    beforeEach(async () => {
      await addLiquidityTokenPair(token0Amount, token1Amount);
      await token0.approve(router.address, ethers.constants.MaxUint256);
      await token0.connect(user).approve(router.address, ethers.constants.MaxUint256);
      await token0.connect(godModeUser).approve(router.address, ethers.constants.MaxUint256);
      await token0.connect(user).approve(router.address, ethers.constants.MaxUint256);
    });

    it("default referral rate", async () => {
      token0reserve = await token0.balanceOf(pair.address);
      token1reserve = await token1.balanceOf(pair.address);
      const expectedOutputAmount = BigNumber.from("1985023029839830096");

      await expect(
        router.connect(user).swapExactTokensForTokens(
          {
            fork: factory.address,
            referee: godModeUser.address,
            fee: true,
          },
          swapAmount,
          0,
          [token0.address, token1.address],
          overrides
        )
      )
        .to.emit(token0, "Transfer")
        .withArgs(user.address, pair.address, swapAmountAfterFee)
        .to.emit(token0, "Transfer")
        .withArgs(user.address, godModeUser.address, referralReward)
        .to.emit(router, "ReferralRewardPaid")
        .withArgs(user.address, godModeUser.address, token1.address, token0.address, referralReward)
        .to.emit(token1, "Transfer")
        .withArgs(pair.address, user.address, expectedOutputAmount)
        .to.emit(pair, "Sync")
        .withArgs(token0reserve.add(swapAmountAfterFee), token1reserve.sub(expectedOutputAmount))
        .to.emit(pair, "Swap")
        .withArgs(router.address, swapAmountAfterFee, 0, 0, expectedOutputAmount, user.address);
    });

    it("custom referral rate", async () => {
      token0reserve = await token0.balanceOf(pair.address);
      token1reserve = await token1.balanceOf(pair.address);
      let expectedOutputAmount = BigNumber.from("1985023029839830096");

      await router.updateCustomReferralRewardRate(godModeUser.address, 2500); // 25% of fee
      let referralReward = ethers.utils.parseEther("0.00125");
      expectedOutputAmount = BigNumber.from("1985023029839830096");
      token0reserve = await token0.balanceOf(pair.address);
      token1reserve = await token1.balanceOf(pair.address);

      await expect(
        router.connect(user).swapExactTokensForTokens(
          {
            fork: factory.address,
            referee: godModeUser.address,
            fee: true,
          },
          swapAmount,
          0,
          [token0.address, token1.address],
          overrides
        )
      )
        .to.emit(token0, "Transfer")
        .withArgs(user.address, pair.address, swapAmountAfterFee)
        .to.emit(token0, "Transfer")
        .withArgs(user.address, godModeUser.address, referralReward)
        .to.emit(token0, "Transfer")
        .withArgs(user.address, feeReceiver.address, swapAmount.sub(swapAmountAfterFee).sub(referralReward))
        .to.emit(router, "ReferralRewardPaid")
        .withArgs(user.address, godModeUser.address, token1.address, token0.address, referralReward)
        .to.emit(token1, "Transfer")
        .withArgs(pair.address, user.address, expectedOutputAmount)
        .to.emit(pair, "Sync")
        .withArgs(token0reserve.add(swapAmountAfterFee), token1reserve.sub(expectedOutputAmount))
        .to.emit(pair, "Swap")
        .withArgs(router.address, swapAmountAfterFee, 0, 0, expectedOutputAmount, user.address);
    });
  });

  describe("Owner functions", () => {
    it("Cannot trade with paused router", async () => {
      const swapAmount = expandTo18Decimals(1);
      await router.pause();

      it("happy path without referral", async () => {
        await expect(
          router
            .swapExactETHForTokens(
              {
                fork: factory.address,
                referee: ethers.constants.AddressZero,
                fee: true,
              },
              0,
              [WETH.address, WETHPartner.address],
              {
                ...overrides,
                value: swapAmount,
              }
            )
            .to.be.revertedWith("Pausable: paused")
        );
      });
    });

    it("Can trade with unpaused router", async () => {
      const swapAmount = expandTo18Decimals(1);
      await router.unpause();

      it("happy path without referral", async () => {
        await router.swapExactETHForTokens(
          {
            fork: factory.address,
            referee: ethers.constants.AddressZero,
            fee: true,
          },
          0,
          [WETH.address, WETHPartner.address],
          {
            ...overrides,
            value: swapAmount,
          }
        );
      });
    });

    it("only owner can withdraw ETH", async () => {
      await wallet.sendTransaction({
        to: router.address,
        value: expandTo18Decimals(2),
      });

      await expect(router.connect(wallet).withdrawETH(owner.address, expandTo18Decimals(2))).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      await expect(await ethers.provider.getBalance(router.address)).to.eq(expandTo18Decimals(2));

      await router.withdrawETH(owner.address, expandTo18Decimals(2));
      await expect(await ethers.provider.getBalance(router.address)).to.eq(expandTo18Decimals(0));
    });

    it("only owner can withdraw Tokens", async () => {
      await expect(router.connect(wallet).withdrawERC20Token(token0.address, wallet.address, 100)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await expect(await token0.balanceOf(wallet.address)).to.eq(expandTo18Decimals(0));
      await token0.transfer(router.address, expandTo18Decimals(100));
      await router.withdrawERC20Token(token0.address, wallet.address, expandTo18Decimals(25));
      await expect(await token0.balanceOf(router.address)).to.eq(expandTo18Decimals(75));
      await expect(await token0.balanceOf(wallet.address)).to.eq(expandTo18Decimals(25));
    });

    it("only owner can update swapFee", async () => {
      await expect(router.connect(wallet).updateSwapFee(100)).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(await router.updateSwapFee(100))
        .to.emit(router, "SwapFeeUpdated")
        .withArgs(100);
    });

    it("only owner can update feeReceiver", async () => {
      await expect(router.connect(wallet).updateFeeReceiver(wallet.address)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      await expect(await router.updateFeeReceiver(wallet.address))
        .to.emit(router, "FeeReceiverUpdated")
        .withArgs(wallet.address);
    });

    it("only owner can update referralRewardRate", async () => {
      await expect(router.connect(wallet).updateReferralRewardRate(5500)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      await expect(await router.updateReferralRewardRate(5500))
        .to.emit(router, "ReferralRewardRateUpdated")
        .withArgs(5500);
    });

    it("only owner can update referralsActivated", async () => {
      await expect(router.connect(wallet).updateReferralsActivated(true)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      await expect(await router.updateReferralsActivated(true))
        .to.emit(router, "ReferralsActivatedUpdated")
        .withArgs(true);
    });

    it("only owner can update custom referral fees", async () => {
      await expect(router.connect(wallet).updateCustomReferralRewardRate(wallet.address, 25)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      await expect(await router.updateCustomReferralRewardRate(wallet.address, 25))
        .to.emit(router, "CustomReferralRewardRateUpdated")
        .withArgs(wallet.address, 25);
    });

    it("only owner can update referral registry", async () => {
      await expect(router.connect(wallet).updateReferralRegistry(referralRegistry.address)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      await expect(await router.updateReferralRegistry(referralRegistry.address))
        .to.emit(router, "ReferralRegistryUpdated")
        .withArgs(referralRegistry.address);
    });

    it("only owner can update forks", async () => {
      await expect(
        router
          .connect(wallet)
          .updateFork(factoryV2.address, "0xc83a08e2be7ce8e8bfb5d13665a763dfdbc982313a2b209e7a0b426ee9775bfc", true)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        await router.updateFork(
          factoryV2.address,
          "0xc83a08e2be7ce8e8bfb5d13665a763dfdbc982313a2b209e7a0b426ee9775bfc",
          true
        )
      ).to.emit(router, "ForkUpdated");
    });

    it("throws if trying to update custom referral fee that is too high", async () => {
      await expect(router.updateCustomReferralRewardRate(wallet.address, 10001)).to.be.revertedWith(
        "FloozRouter: INVALID_RATE"
      );
    });
  });

  describe("View functions", () => {
    it("returns referee correcly", async () => {
      expect(await router.getUserReferee(user.address)).to.eq(godModeUser.address);
      expect(await router.hasUserReferee(user.address)).to.eq(true);
      expect(await router.getUserReferee(godModeUser.address)).to.eq(ethers.constants.AddressZero);
      expect(await router.hasUserReferee(godModeUser.address)).to.eq(false);
    });
  });
});
