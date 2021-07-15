import chai, { expect } from 'chai'
import { BigNumber, Contract, utils } from 'ethers'
import { solidity, createFixtureLoader } from 'ethereum-waffle'
import hre, { ethers, waffle } from 'hardhat'

import { expandTo18Decimals, mineBlock, latestBlockTimestamp } from './shared/utilities'
import { v2Fixture } from './shared/fixtures'

chai.use(solidity)

const overrides = {
    gasLimit: 9999999,
}

describe.only('FloozRouter', () => {
    const [owner, wallet] = waffle.provider.getWallets()
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

        /*
        hre.tracer.nameTags[owner.address] = 'Owner'
        hre.tracer.nameTags[wallet.address] = 'Wallet'
        hre.tracer.nameTags[pair.address] = 'pair'
        hre.tracer.nameTags[token0.address] = 'token0'
        hre.tracer.nameTags[token1.address] = 'token1'
        hre.tracer.nameTags[router.address] = 'floozRouter'
        hre.tracer.nameTags[pancakeRouterV2.address] = 'pancakeRouterV2'
        hre.tracer.nameTags[WETHPair.address] = 'WETHPair'
        */
    })

    afterEach(async function () {
        expect(await ethers.provider.getBalance(router.address)).to.eq(0)
    })

    describe('FloozRouter', () => {
        async function addLiquidity(token0Amount: BigNumber, token1Amount: BigNumber) {
            await token0.transfer(pair.address, token0Amount)
            await token1.transfer(pair.address, token1Amount)
            await pair.mint(wallet.address, overrides)
        }

        describe('Router', async () => {
            beforeEach(async function () {
                await expect(await ethers.provider.getBalance(router.address)).to.eq(expandTo18Decimals(0))
            })

            it('factory, WETH', async () => {
                expect(await router.pancakeFactoryV1()).to.eq(factory.address)
                expect(await router.WETH()).to.eq(WETH.address)
            })

            describe('swapExactTokensForTokens', () => {
                const token0Amount = expandTo18Decimals(5)
                const token1Amount = expandTo18Decimals(10)
                const amountIn = ethers.utils.parseEther('1')
                const swapAmount = ethers.utils.parseEther('0.99')
                const feeAmount = ethers.utils.parseEther('0.01')
                const expectedOutputAmount = BigNumber.from('1649304178270654402')

                beforeEach(async () => {
                    await addLiquidity(token0Amount, token1Amount)
                    await token0.approve(router.address, ethers.constants.MaxUint256)
                })

                it('happy path', async () => {
                    /*
                await expect(
                    router
                        .connect(owner)
                        .swapExactTokensForTokens(
                            pancakeRouterV2.address,
                            amountIn,
                            0,
                            [token0.address, token1.address],
                            owner.address,
                            ethers.constants.MaxUint256,
                            overrides
                        )
                )
                    .to.emit(token0, 'Transfer')
                    .withArgs(owner.address, pair.address, swapAmount)
                    .to.emit(token0, 'Transfer')
                    .withArgs(owner.address, owner.address, feeAmount)
                    .to.emit(token1, 'Transfer')
                    .withArgs(pair.address, owner.address, expectedOutputAmount)
                    .to.emit(pair, 'Sync')
                    .withArgs(token0Amount.add(swapAmount), token1Amount.sub(expectedOutputAmount))
                    .to.emit(pair, 'Swap')
                    .withArgs(router.address, swapAmount, 0, 0, expectedOutputAmount, owner.address)
                    */
                })

                it('gas', async () => {
                    // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
                    await pair.sync(overrides)

                    await token0.approve(router.address, ethers.constants.MaxUint256)
                    const tx = await router.swapExactTokensForTokens(
                        factory.address,
                        swapAmount,
                        0,
                        [token0.address, token1.address],
                        wallet.address,
                        ethers.constants.MaxUint256,
                        overrides
                    )
                    const receipt = await tx.wait()
                    expect(receipt.gasUsed).to.eq(125679)
                }).retries(3)
            })

            describe.only('swapExactETHForTokens', () => {
                const WETHPartnerAmount = expandTo18Decimals(10)
                const ETHAmount = expandTo18Decimals(5)
                const swapAmount = expandTo18Decimals(1)
                const expectedOutputAmount = BigNumber.from('1662497915624478906')

                beforeEach(async () => {
                    await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
                    await WETH.deposit({ value: ETHAmount })
                    await WETH.transfer(WETHPair.address, ETHAmount)
                    await WETHPair.mint(wallet.address, overrides)

                    await token0.approve(router.address, ethers.constants.MaxUint256)
                })

                it('happy path', async () => {
                    const WETHPairToken0 = await WETHPair.token0()

                    await expect(
                        router
                            .connect(owner)
                            .swapExactETHForTokens(
                                pancakeRouterV2.address,
                                0,
                                [WETH.address, WETHPartner.address],
                                wallet.address,
                                ethers.constants.AddressZero,
                                {
                                    value: swapAmount,
                                }
                            )
                    )
                        .to.emit(WETH, 'Transfer')
                        .withArgs(pancakeRouterV2.address, WETHPair.address, swapAmount)
                        .to.emit(WETHPartner, 'Transfer')
                        .withArgs(WETHPair.address, wallet.address, expectedOutputAmount)
                        .to.emit(WETHPair, 'Sync')
                        .withArgs(
                            WETHPairToken0 === WETHPartner.address
                                ? WETHPartnerAmount.sub(expectedOutputAmount)
                                : ETHAmount.add(swapAmount),
                            WETHPairToken0 === WETHPartner.address ? ETHAmount.add(swapAmount) : WETHPartnerAmount.sub(expectedOutputAmount)
                        )
                        .to.emit(WETHPair, 'Swap')
                        .withArgs(
                            pancakeRouterV2.address,
                            WETHPairToken0 === WETHPartner.address ? 0 : swapAmount,
                            WETHPairToken0 === WETHPartner.address ? swapAmount : 0,
                            WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
                            WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
                            wallet.address
                        )
                })
            })

            describe.only('swapExactTokensForETH', () => {
                const amountIn = expandTo18Decimals(1)
                const swapAmount = ethers.utils.parseEther('0.995')
                const feeAmount = ethers.utils.parseEther('0.005')
                const expectedOutputAmount = BigNumber.from('991528395673189413')
                const WETHPartnerAmount = expandTo18Decimals(1000)
                const ETHAmount = expandTo18Decimals(1000)

                beforeEach(async () => {
                    await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
                    await WETH.deposit({ value: ETHAmount })
                    await WETH.transfer(WETHPair.address, ETHAmount)
                    await WETHPair.mint(wallet.address, overrides)

                    await token0.approve(router.address, ethers.constants.MaxUint256)
                })

                it('happy path', async () => {
                    await WETHPartner.approve(router.address, amountIn)
                    const WETHPairToken0 = await WETHPair.token0()
                    await expect(
                        router
                            .connect(owner)
                            .swapExactTokensForETH(
                                pancakeRouterV2.address,
                                amountIn,
                                0,
                                [WETHPartner.address, WETH.address],
                                owner.address,
                                ethers.constants.AddressZero,
                                overrides
                            )
                    )
                        .to.emit(WETHPartner, 'Transfer')
                        .withArgs(owner.address, router.address, amountIn)
                        .to.emit(WETHPartner, 'Transfer')
                        .withArgs(router.address, WETHPair.address, amountIn)
                        .to.emit(WETH, 'Transfer')
                        .withArgs(WETHPair.address, pancakeRouterV2.address, expectedOutputAmount)
                        .to.emit(WETHPair, 'Sync')
                        .withArgs(
                            WETHPairToken0 === WETHPartner.address ? WETHPartnerAmount.add(amountIn) : ETHAmount.sub(expectedOutputAmount),
                            WETHPairToken0 === WETHPartner.address ? ETHAmount.sub(expectedOutputAmount) : WETHPartnerAmount.add(amountIn)
                        )
                    /*
                    .to.emit(WETHPair, 'Swap')
                    .withArgs(
                        pancakeRouterV2.address,
                        WETHPairToken0 === WETHPartner.address ? swapAmount : 0,
                        WETHPairToken0 === WETHPartner.address ? 0 : swapAmount,
                        WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
                        WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
                        pancakeRouterV2.address
                    )*/
                })
            })
        })
    })
})
