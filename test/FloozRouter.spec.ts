import chai, { expect } from 'chai'
import { BigNumber, Contract, utils } from 'ethers'
import { solidity, createFixtureLoader } from 'ethereum-waffle'
import hre, { ethers, waffle } from 'hardhat'

import { expandTo18Decimals, expandTo9Decimals, mineBlock, latestBlockTimestamp } from './shared/utilities'
import { v2Fixture } from './shared/fixtures'

chai.use(solidity)

const overrides = {
    gasLimit: 9999999,
}

describe('FloozRouter', () => {
    const [owner, wallet, syaHolder] = waffle.provider.getWallets()
    const loadFixture = createFixtureLoader([owner])

    let token0: Contract
    let token1: Contract
    let WETH: Contract
    let WETHPartner: Contract
    let factory: Contract
    let router: Contract
    let pair: Contract
    let WETHPair: Contract
    let pancakeRouterV2: Contract
    let syaToken: Contract
    let DTT: Contract

    beforeEach(async function () {
        const fixture = await loadFixture(v2Fixture)
        token0 = fixture.token0
        token1 = fixture.token1
        WETH = fixture.WETH
        WETHPartner = fixture.WETHPartner
        factory = fixture.factoryV2
        router = fixture.router
        pair = fixture.pair
        WETHPair = fixture.WETHPair
        pancakeRouterV2 = fixture.pancakeRouterV2
        syaToken = fixture.syaToken
        DTT = fixture.dtt

        hre.tracer.nameTags[owner.address] = 'Owner'
        hre.tracer.nameTags[wallet.address] = 'Wallet'
        hre.tracer.nameTags[pair.address] = 'pair'
        hre.tracer.nameTags[token0.address] = 'token0'
        hre.tracer.nameTags[token1.address] = 'token1'
        hre.tracer.nameTags[router.address] = 'floozRouter'
        hre.tracer.nameTags[pancakeRouterV2.address] = 'pancakeRouterV2'
        hre.tracer.nameTags[WETHPair.address] = 'WETHPair'
        hre.tracer.nameTags[WETH.address] = 'WETH'
        hre.tracer.nameTags[WETHPartner.address] = 'WETHPartner'
    })

    afterEach(async function () {
        expect(await ethers.provider.getBalance(router.address)).to.eq(ethers.constants.Zero)
    })

    describe('Swaps', () => {
        async function addLiquidity(token0Amount: BigNumber, token1Amount: BigNumber) {
            await token0.transfer(pair.address, token0Amount)
            await token1.transfer(pair.address, token1Amount)
            await pair.mint(wallet.address, overrides)
        }

        describe('factory', () => {
            const swapAmount = expandTo18Decimals(1)

            it('cannot swap with invalid factory address', async () => {
                await expect(
                    router.swapExactTokensForTokens(
                        wallet.address,
                        swapAmount,
                        0,
                        [token0.address, token1.address],
                        ethers.constants.AddressZero,
                        overrides
                    )
                ).to.be.revertedWith('FloozRouter: invalid factory')
            })
        })

        describe('swapExactTokensForTokens', () => {
            const token0Amount = expandTo18Decimals(5)
            const token1Amount = expandTo18Decimals(10)
            const swapAmount = expandTo18Decimals(1)
            const swapAmountAfterFee = ethers.utils.parseEther('0.995')
            const referralReward = ethers.utils.parseEther('0.0005')
            const expectedOutputAmount = BigNumber.from('1656254367429354548')
            const expectedOutputAmountSyaHolder = BigNumber.from('1525777466624074950')
            let token0reserve: BigNumber, token1reserve: BigNumber

            beforeEach(async () => {
                await addLiquidity(token0Amount, token1Amount)
                await token0.approve(router.address, ethers.constants.MaxUint256)
                await token0.connect(syaHolder).approve(router.address, ethers.constants.MaxUint256)
            })

            it('happy path', async () => {
                await expect(
                    router.swapExactTokensForTokens(
                        factory.address,
                        swapAmount,
                        0,
                        [token0.address, token1.address],
                        ethers.constants.AddressZero,
                        overrides
                    )
                )
                    .to.emit(token0, 'Transfer')
                    .withArgs(owner.address, pair.address, swapAmountAfterFee)
                    .to.emit(token1, 'Transfer')
                    .withArgs(pair.address, owner.address, expectedOutputAmount)
                    .to.emit(pair, 'Sync')
                    .withArgs(token0Amount.add(swapAmountAfterFee), token1Amount.sub(expectedOutputAmount))
                    .to.emit(pair, 'Swap')
                    .withArgs(router.address, swapAmountAfterFee, 0, 0, expectedOutputAmount, owner.address)
            })

            it('SYA holder – no fees', async () => {
                token0reserve = await token0.balanceOf(pair.address)
                token1reserve = await token1.balanceOf(pair.address)
                await syaToken.transfer(syaHolder.address, expandTo9Decimals(10000))
                await token0.transfer(syaHolder.address, expandTo18Decimals(4000))
                await router.updateBalanceThreshold(expandTo9Decimals(5000))

                await expect(
                    router
                        .connect(syaHolder)
                        .swapExactTokensForTokens(
                            factory.address,
                            swapAmount,
                            0,
                            [token0.address, token1.address],
                            ethers.constants.AddressZero,
                            overrides
                        )
                )
                    .to.emit(token0, 'Transfer')
                    .withArgs(syaHolder.address, pair.address, swapAmount)
                    .to.emit(token1, 'Transfer')
                    .withArgs(pair.address, syaHolder.address, expectedOutputAmountSyaHolder)
                    .to.emit(pair, 'Sync')
                    .withArgs(token0reserve.add(swapAmount), token1reserve.sub(expectedOutputAmountSyaHolder))
                    .to.emit(pair, 'Swap')
                    .withArgs(router.address, swapAmount, 0, 0, expectedOutputAmountSyaHolder, syaHolder.address)
            })

            it('referral', async () => {
                token0reserve = await token0.balanceOf(pair.address)
                token1reserve = await token1.balanceOf(pair.address)
                const expectedOutputAmount = BigNumber.from('1479758172749236202')

                await expect(
                    router.swapExactTokensForTokens(
                        factory.address,
                        swapAmount,
                        0,
                        [token0.address, token1.address],
                        syaHolder.address,
                        overrides
                    )
                )
                    .to.emit(token0, 'Transfer')
                    .withArgs(owner.address, pair.address, swapAmountAfterFee)
                    .to.emit(token0, 'Transfer')
                    .withArgs(owner.address, syaHolder.address, referralReward)
                    .to.emit(router, 'ReferralRewardPaid')
                    .withArgs(owner.address, syaHolder.address, token1.address, token0.address, referralReward)
                    .to.emit(token1, 'Transfer')
                    .withArgs(pair.address, owner.address, expectedOutputAmount)
                    .to.emit(pair, 'Sync')
                    .withArgs(token0reserve.add(swapAmountAfterFee), token1reserve.sub(expectedOutputAmount))
                    .to.emit(pair, 'Swap')
                    .withArgs(router.address, swapAmountAfterFee, 0, 0, expectedOutputAmount, owner.address)
            })
        })

        describe('swapTokensForExactTokens', () => {
            const token0Amount = expandTo18Decimals(5)
            const token1Amount = expandTo18Decimals(10)
            const expectedSwapAmount = BigNumber.from('671194539615925225')
            const outputAmount = expandTo18Decimals(1)
            let token0reserve: BigNumber, token1reserve: BigNumber

            beforeEach(async () => {
                await addLiquidity(token0Amount, token1Amount)
            })

            it('without referral', async () => {
                token0reserve = await token0.balanceOf(pair.address)
                token1reserve = await token1.balanceOf(pair.address)
                await token0.approve(router.address, ethers.constants.MaxUint256)
                await expect(
                    router.swapTokensForExactTokens(
                        factory.address,
                        outputAmount,
                        ethers.constants.MaxUint256,
                        [token0.address, token1.address],
                        ethers.constants.AddressZero,
                        overrides
                    )
                )
                    .to.emit(token0, 'Transfer')
                    .withArgs(owner.address, pair.address, expectedSwapAmount)
                    .to.emit(token1, 'Transfer')
                    .withArgs(pair.address, owner.address, outputAmount)
                    .to.emit(pair, 'Sync')
                    .withArgs(token0reserve.add(expectedSwapAmount), token1reserve.sub(outputAmount))
                    .to.emit(pair, 'Swap')
                    .withArgs(router.address, expectedSwapAmount, 0, 0, outputAmount, owner.address)
            })
        })

        describe('swapExactETHForTokens', () => {
            const WETHPartnerAmount = expandTo18Decimals(10)
            const ETHAmount = expandTo18Decimals(5)
            const swapAmount = expandTo18Decimals(1)
            const swapAmountAfterFee = ethers.utils.parseEther('0.995')
            const referralReward = ethers.utils.parseEther('0.0005')
            const expectedOutputAmount = BigNumber.from('1656254367429354548')

            beforeEach(async () => {
                await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
                await WETH.deposit({ value: ETHAmount })
                await WETH.transfer(WETHPair.address, ETHAmount)
                await WETHPair.mint(wallet.address, overrides)

                await token0.approve(router.address, ethers.constants.MaxUint256)
            })

            it('without referral', async () => {
                const WETHPairToken0 = await WETHPair.token0()
                await expect(
                    router.swapExactETHForTokens(factory.address, 0, [WETH.address, WETHPartner.address], ethers.constants.AddressZero, {
                        ...overrides,
                        value: swapAmount,
                    })
                )
                    .to.emit(WETH, 'Transfer')
                    .withArgs(router.address, WETHPair.address, swapAmountAfterFee)
                    .to.emit(WETHPartner, 'Transfer')
                    .withArgs(WETHPair.address, owner.address, expectedOutputAmount)
                    .to.emit(WETHPair, 'Sync')
                    .withArgs(
                        WETHPairToken0 === WETHPartner.address
                            ? WETHPartnerAmount.sub(expectedOutputAmount)
                            : ETHAmount.add(swapAmountAfterFee),
                        WETHPairToken0 === WETHPartner.address
                            ? ETHAmount.add(swapAmountAfterFee)
                            : WETHPartnerAmount.sub(expectedOutputAmount)
                    )
                    .to.emit(WETHPair, 'Swap')
                    .withArgs(
                        router.address,
                        WETHPairToken0 === WETHPartner.address ? 0 : swapAmountAfterFee,
                        WETHPairToken0 === WETHPartner.address ? swapAmountAfterFee : 0,
                        WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
                        WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
                        owner.address
                    )
            })

            it('referral', async () => {
                let WETHPartnerReserve = await WETHPartner.balanceOf(WETHPair.address)
                let WETHReserve = await WETH.balanceOf(WETHPair.address)
                const WETHPairToken0 = await WETHPair.token0()
                const expectedOutputAmount = BigNumber.from('1518780217092309413')

                await expect(
                    router.swapExactETHForTokens(factory.address, 0, [WETH.address, WETHPartner.address], syaHolder.address, {
                        ...overrides,
                        value: swapAmount,
                    })
                )
                    .to.emit(WETH, 'Transfer')
                    .withArgs(router.address, WETHPair.address, swapAmountAfterFee)
                    .to.emit(WETHPartner, 'Transfer')
                    .withArgs(WETHPair.address, owner.address, expectedOutputAmount)
                    .to.emit(router, 'ReferralRewardPaid')
                    .withArgs(owner.address, syaHolder.address, WETHPartner.address, ethers.constants.AddressZero, referralReward)
                    .to.emit(WETHPair, 'Sync')
                    .withArgs(
                        WETHPairToken0 === WETHPartner.address
                            ? WETHPartnerReserve.sub(expectedOutputAmount)
                            : WETHReserve.add(swapAmountAfterFee),
                        WETHPairToken0 === WETHPartner.address
                            ? WETHReserve.add(swapAmountAfterFee)
                            : WETHPartnerReserve.sub(expectedOutputAmount)
                    )
                    .to.emit(WETHPair, 'Swap')
                    .withArgs(
                        router.address,
                        WETHPairToken0 === WETHPartner.address ? 0 : swapAmountAfterFee,
                        WETHPairToken0 === WETHPartner.address ? swapAmountAfterFee : 0,
                        WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
                        WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
                        owner.address
                    )
            })
        })

        describe('swapTokensForExactETH', () => {
            const WETHPartnerAmount = expandTo18Decimals(5)
            const ETHAmount = expandTo18Decimals(10)
            const expectedSwapAmount = BigNumber.from('1042385163264442003')
            const outputAmount = expandTo18Decimals(1)
            let WETHPartnerReserve: BigNumber, WETHReserve: BigNumber

            beforeEach(async () => {
                await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
                await WETH.deposit({ value: ETHAmount })
                await WETH.transfer(WETHPair.address, ETHAmount)
                await WETHPair.mint(wallet.address, overrides)

                WETHPartnerReserve = await WETHPartner.balanceOf(WETHPair.address)
                WETHReserve = await WETH.balanceOf(WETHPair.address)
            })

            it('happy path without referral', async () => {
                await WETHPartner.approve(router.address, ethers.constants.MaxUint256)
                const WETHPairToken0 = await WETHPair.token0()
                await expect(
                    router.swapTokensForExactETH(
                        factory.address,
                        outputAmount,
                        ethers.constants.MaxUint256,
                        [WETHPartner.address, WETH.address],
                        ethers.constants.AddressZero,
                        overrides
                    )
                )
                    .to.emit(WETHPartner, 'Transfer')
                    .withArgs(owner.address, WETHPair.address, expectedSwapAmount)
                    .to.emit(WETH, 'Transfer')
                    .withArgs(WETHPair.address, router.address, outputAmount)
                    .to.emit(WETHPair, 'Sync')
                    .withArgs(
                        WETHPairToken0 === WETHPartner.address ? WETHPartnerReserve.add(expectedSwapAmount) : WETHReserve.sub(outputAmount),
                        WETHPairToken0 === WETHPartner.address ? WETHReserve.sub(outputAmount) : WETHPartnerReserve.add(expectedSwapAmount)
                    )
                    .to.emit(WETHPair, 'Swap')
                    .withArgs(
                        router.address,
                        WETHPairToken0 === WETHPartner.address ? expectedSwapAmount : 0,
                        WETHPairToken0 === WETHPartner.address ? 0 : expectedSwapAmount,
                        WETHPairToken0 === WETHPartner.address ? 0 : outputAmount,
                        WETHPairToken0 === WETHPartner.address ? outputAmount : 0,
                        router.address
                    )
            })
        })

        describe('swapExactTokensForETH', () => {
            const WETHPartnerAmount = expandTo18Decimals(5)
            const ETHAmount = expandTo18Decimals(10)
            const swapAmount = expandTo18Decimals(1)
            const swapAmountAfterFee = ethers.utils.parseEther('0.995')
            const expectedOutputAmount = BigNumber.from('1070940066558501802')
            let WETHPartnerReserve: BigNumber, WETHReserve: BigNumber

            beforeEach(async () => {
                await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
                await WETH.deposit({ value: ETHAmount })
                await WETH.transfer(WETHPair.address, ETHAmount)
                await WETHPair.mint(wallet.address, overrides)

                WETHPartnerReserve = await WETHPartner.balanceOf(WETHPair.address)
                WETHReserve = await WETH.balanceOf(WETHPair.address)
            })

            it('happy path without referral', async () => {
                await WETHPartner.approve(router.address, ethers.constants.MaxUint256)
                const WETHPairToken0 = await WETHPair.token0()
                await expect(
                    router.swapExactTokensForETH(
                        factory.address,
                        swapAmount,
                        0,
                        [WETHPartner.address, WETH.address],
                        ethers.constants.AddressZero,
                        overrides
                    )
                )
                    .to.emit(WETHPartner, 'Transfer')
                    .withArgs(owner.address, WETHPair.address, swapAmount)
                    .to.emit(WETH, 'Transfer')
                    .withArgs(WETHPair.address, router.address, expectedOutputAmount)
                    .to.emit(WETHPair, 'Sync')
                    .withArgs(
                        WETHPairToken0 === WETHPartner.address ? WETHPartnerReserve.add(swapAmount) : WETHReserve.sub(expectedOutputAmount),
                        WETHPairToken0 === WETHPartner.address ? WETHReserve.sub(expectedOutputAmount) : WETHPartnerReserve.add(swapAmount)
                    )
                    .to.emit(WETHPair, 'Swap')
                    .withArgs(
                        router.address,
                        WETHPairToken0 === WETHPartner.address ? swapAmount : 0,
                        WETHPairToken0 === WETHPartner.address ? 0 : swapAmount,
                        WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
                        WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
                        router.address
                    )
            })
        })

        describe('swapETHForExactTokens', () => {
            const WETHPartnerAmount = expandTo18Decimals(40)
            const ETHAmount = expandTo18Decimals(5)
            const expectedSwapAmount = BigNumber.from('525808795773767893')
            const expectedSwapAmountAfterFee = BigNumber.from('515808795773767893')
            const outputAmount = expandTo18Decimals(1)
            let WETHPartnerReserve: BigNumber, WETHReserve: BigNumber

            beforeEach(async () => {
                await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
                await WETH.deposit({ value: ETHAmount })
                await WETH.transfer(WETHPair.address, ETHAmount)
                await WETHPair.mint(wallet.address, overrides)
                WETHPartnerReserve = await WETHPartner.balanceOf(WETHPair.address)
                WETHReserve = await WETH.balanceOf(WETHPair.address)
            })

            it('happy path ', async () => {
                const WETHPairToken0 = await WETHPair.token0()
                await expect(
                    router.swapETHForExactTokens(
                        factory.address,
                        outputAmount,
                        [WETH.address, WETHPartner.address],
                        ethers.constants.AddressZero,
                        {
                            ...overrides,
                            value: expectedSwapAmount,
                        }
                    )
                )
                    .to.emit(WETH, 'Transfer')
                    .withArgs(router.address, WETHPair.address, expectedSwapAmountAfterFee)
                    .to.emit(WETHPartner, 'Transfer')
                    .withArgs(WETHPair.address, owner.address, outputAmount)
                    .to.emit(WETHPair, 'Sync')
                    .withArgs(
                        WETHPairToken0 === WETHPartner.address
                            ? WETHPartnerReserve.sub(outputAmount)
                            : WETHReserve.add(expectedSwapAmountAfterFee),
                        WETHPairToken0 === WETHPartner.address
                            ? WETHReserve.add(expectedSwapAmountAfterFee)
                            : WETHPartnerReserve.sub(outputAmount)
                    )
                    .to.emit(WETHPair, 'Swap')
                    .withArgs(
                        router.address,
                        WETHPairToken0 === WETHPartner.address ? 0 : expectedSwapAmountAfterFee,
                        WETHPairToken0 === WETHPartner.address ? expectedSwapAmountAfterFee : 0,
                        WETHPairToken0 === WETHPartner.address ? outputAmount : 0,
                        WETHPairToken0 === WETHPartner.address ? 0 : outputAmount,
                        owner.address
                    )
            })
        })
    })

    describe('Swaps Supporting Fees', () => {
        async function addLiquidity(DTTAmount: BigNumber, ETHAmount: BigNumber) {
            await DTT.approve(pancakeRouterV2.address, ethers.constants.MaxUint256)
            await pancakeRouterV2.addLiquidityETH(DTT.address, DTTAmount, 0, ETHAmount, wallet.address, ethers.constants.MaxUint256, {
                value: ETHAmount,
            })
        }

        describe('swapExactTokensForETHSupportingFeeOnTransferTokens', () => {
            const swapAmount = expandTo18Decimals(1)

            beforeEach(async () => {
                await addLiquidity(expandTo18Decimals(100), expandTo18Decimals(100))
            })

            it('happy path ', async () => {
                await DTT.approve(router.address, ethers.constants.MaxUint256)
                await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
                    factory.address,
                    swapAmount,
                    0,
                    [DTT.address, WETH.address],
                    ethers.constants.AddressZero,
                    overrides
                )
            })
        })

        describe('swapExactETHForTokensSupportingFeeOnTransferTokens', () => {
            const swapAmount = expandTo18Decimals(1)
            const amountOutMin = BigNumber.from('525808795773767893')

            beforeEach(async () => {
                await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(9))
            })

            it('happy path ', async () => {
                await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
                    factory.address,
                    amountOutMin,
                    [WETH.address, DTT.address],
                    ethers.constants.AddressZero,
                    {
                        value: swapAmount,
                    }
                )
            })
        })

        describe('swapExactTokensForTokensSupportingFeeOnTransferTokens', () => {
            const swapAmount = expandTo18Decimals(1)

            beforeEach(async () => {
                await addLiquidity(expandTo18Decimals(10), expandTo18Decimals(9))
            })

            it('happy path', async () => {
                await DTT.approve(router.address, ethers.constants.MaxUint256)
                await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                    factory.address,
                    swapAmount,
                    0,
                    [DTT.address, WETH.address],
                    ethers.constants.AddressZero,
                    overrides
                )
            })
        })
    })

    describe('Owner functions', () => {
        it('Cannot trade with paused router', async () => {
            const swapAmount = expandTo18Decimals(1)
            await router.pause()

            it('happy path without referral', async () => {
                await expect(
                    router
                        .swapExactETHForTokens(factory.address, 0, [WETH.address, WETHPartner.address], ethers.constants.AddressZero, {
                            ...overrides,
                            value: swapAmount,
                        })
                        .to.be.revertedWith('Pausable: paused')
                )
            })
        })

        it('Can trade with unpaused router', async () => {
            const swapAmount = expandTo18Decimals(1)
            await router.unpause()

            it('happy path without referral', async () => {
                await router.swapExactETHForTokens(factory.address, 0, [WETH.address, WETHPartner.address], ethers.constants.AddressZero, {
                    ...overrides,
                    value: swapAmount,
                })
            })
        })

        it('only owner can withdraw BNB', async () => {
            await wallet.sendTransaction({
                to: router.address,
                value: expandTo18Decimals(2),
            })

            await expect(router.connect(wallet).withdrawBnb(owner.address, expandTo18Decimals(2))).to.be.revertedWith(
                'Ownable: caller is not the owner'
            )

            await expect(await ethers.provider.getBalance(router.address)).to.eq(expandTo18Decimals(2))

            await router.withdrawBnb(owner.address, expandTo18Decimals(2))
            await expect(await ethers.provider.getBalance(router.address)).to.eq(expandTo18Decimals(0))
        })

        it('only owner can withdraw Tokens', async () => {
            await expect(router.connect(wallet).withdrawErc20Token(token0.address, wallet.address, 100)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            )
            await expect(await token0.balanceOf(wallet.address)).to.eq(expandTo18Decimals(0))
            await token0.transfer(router.address, expandTo18Decimals(100))
            await router.withdrawErc20Token(token0.address, wallet.address, expandTo18Decimals(25))
            await expect(await token0.balanceOf(router.address)).to.eq(expandTo18Decimals(75))
            await expect(await token0.balanceOf(wallet.address)).to.eq(expandTo18Decimals(25))
        })

        it('only owner can update swapFee', async () => {
            await expect(router.connect(wallet).updateSwapFee(100)).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(await router.updateSwapFee(100))
                .to.emit(router, 'SwapFeeUpdated')
                .withArgs(100)
        })

        it('only owner can update feeReceiver', async () => {
            await expect(router.connect(wallet).updateFeeReceiver(wallet.address)).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(await router.updateFeeReceiver(wallet.address))
                .to.emit(router, 'FeeReceiverUpdated')
                .withArgs(wallet.address)
        })

        it('only owner can update balanceThreshold', async () => {
            await expect(router.connect(wallet).updateBalanceThreshold(104)).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(await router.updateBalanceThreshold(104))
                .to.emit(router, 'BalanceThresholdUpdated')
                .withArgs(104)
        })
    })
})
