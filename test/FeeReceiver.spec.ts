import chai, { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'
import { solidity, createFixtureLoader } from 'ethereum-waffle'
import hre, { ethers, waffle } from 'hardhat'

import { expandTo18Decimals, expandTo9Decimals, mineBlock, latestBlockTimestamp } from './shared/utilities'
import { v2Fixture } from './shared/fixtures'

chai.use(solidity)

const overrides = {
    gasLimit: 9999999,
}

describe('FeeReceiver', () => {
    const [owner, wallet, revenueReceiver] = waffle.provider.getWallets()
    const loadFixture = createFixtureLoader([owner, revenueReceiver])

    let token0: Contract
    let token1: Contract
    let WETH: Contract
    let WETHPartner: Contract
    let factory: Contract
    let router: Contract
    let pair: Contract
    let WETHPair: Contract
    let routerEventEmitter: Contract
    let syaToken: Contract
    let syaPair: Contract
    let feeReceiver: Contract
    let pancakeRouterV2: Contract

    beforeEach(async function () {
        const fixture = await loadFixture(v2Fixture)
        token0 = fixture.token0
        token1 = fixture.token1
        WETH = fixture.WETH
        WETHPartner = fixture.WETHPartner
        factory = fixture.factoryV2
        router = fixture.router
        syaToken = fixture.syaToken
        syaPair = fixture.syaPair
        pancakeRouterV2 = fixture.pancakeRouterV2
        feeReceiver = fixture.feeReceiver

        await syaToken.transfer(syaPair.address, expandTo9Decimals(100))
        await WETH.deposit({ value: expandTo18Decimals(100) })
        await WETH.transfer(syaPair.address, expandTo18Decimals(1))
        await syaPair.mint(wallet.address)
    })

    describe('Execute Buybacks', () => {
        it('throws if trying to buyback when paused', async () => {
            await feeReceiver.pause()
            await expect(feeReceiver.executeBuyback()).to.be.revertedWith('Pausable: paused')
            await feeReceiver.unpause()
        })

        it('throws if trying to execute buyback when no BNB balance', async () => {
            await expect(feeReceiver.executeBuyback()).to.be.revertedWith('FeeReceiver: No balance for buyback')
        })

        it('executes buyback', async () => {
            await owner.sendTransaction({
                to: feeReceiver.address,
                value: expandTo18Decimals(10),
            })

            await expect(await ethers.provider.getBalance(feeReceiver.address)).to.eq(expandTo18Decimals(10))
            await expect(feeReceiver.executeBuyback())
                .to.emit(feeReceiver, 'BuybackExecuted')
                .withArgs(expandTo18Decimals(5), expandTo18Decimals(5))
        })
    })

    describe('Unwrap WBNB', () => {
        it('throws if contract has no WETH balance', async () => {
            await expect(feeReceiver.unwrapWBNB()).to.be.revertedWith('FeeReceiver: Nothing to unwrap')
        })

        it('throws when contract is paused', async () => {
            await feeReceiver.pause()
            await expect(feeReceiver.unwrapWBNB()).to.be.revertedWith('Pausable: paused')
            await feeReceiver.unpause()
        })

        it('converts WBNB > BNB', async () => {
            await expect(await ethers.provider.getBalance(feeReceiver.address)).to.eq(expandTo18Decimals(0))
            await WETH.transfer(feeReceiver.address, expandTo18Decimals(2))
            await feeReceiver.unwrapWBNB()
            await expect(await ethers.provider.getBalance(feeReceiver.address)).to.eq(expandTo18Decimals(2))
        })
    })

    describe('Convert Token to BNB', () => {
        it('converts tokens to BNB', async () => {
            await feeReceiver.updateRouterWhiteliste(pancakeRouterV2.address, true)
            await syaToken.transfer(feeReceiver.address, expandTo18Decimals(2))
            await feeReceiver.convertToBnb(pancakeRouterV2.address, syaToken.address, false)
        })
    })

    describe('Admin functions', () => {
        it('only admin can update router whitelist', async () => {
            await expect(feeReceiver.connect(wallet).updateRouterWhiteliste(router.address, true)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            )
            await expect(await feeReceiver.routerWhitelist(router.address)).to.eq(false)

            await expect(feeReceiver.updateRouterWhiteliste(router.address, true))
                .to.emit(feeReceiver, 'RouterWhitelistUpdated')
                .withArgs(router.address, true)

            await expect(await feeReceiver.routerWhitelist(router.address)).to.eq(true)
        })

        it('only admin can update update the buyback rate', async () => {
            await expect(feeReceiver.connect(wallet).updateBuybackRate(10)).to.be.revertedWith('Ownable: caller is not the owner')
            await expect(feeReceiver.updateBuybackRate(10)).to.emit(feeReceiver, 'BuybackRateUpdated').withArgs(10)
        })

        it('only admin can update update the revenue receiver', async () => {
            await expect(feeReceiver.connect(wallet).updateRevenueReceiver(revenueReceiver.address)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            )
            await expect(feeReceiver.updateRevenueReceiver(revenueReceiver.address))
                .to.emit(feeReceiver, 'RevenueReceiverUpdated')
                .withArgs(revenueReceiver.address)
        })

        it('only admin can pause / unpause the contract', async () => {
            await expect(feeReceiver.connect(wallet).pause()).to.be.revertedWith('Ownable: caller is not the owner')
            await expect(feeReceiver.connect(wallet).unpause()).to.be.revertedWith('Ownable: caller is not the owner')
            await expect(feeReceiver.unpause()).to.be.revertedWith('Pausable: not paused')

            await feeReceiver.pause()
            await expect(await feeReceiver.paused()).to.eq(true)
            await expect(feeReceiver.pause()).to.be.revertedWith('Pausable: paused')

            await feeReceiver.unpause()
            await expect(await feeReceiver.paused()).to.eq(false)
        })

        it('only owner can withdraw BNB', async () => {
            await expect(feeReceiver.connect(wallet).withdrawBnb(owner.address, expandTo18Decimals(2))).to.be.revertedWith(
                'Ownable: caller is not the owner'
            )

            await expect(await ethers.provider.getBalance(feeReceiver.address)).to.eq(expandTo18Decimals(2))

            await feeReceiver.withdrawBnb(owner.address, expandTo18Decimals(2))
            await expect(await ethers.provider.getBalance(feeReceiver.address)).to.eq(expandTo18Decimals(0))
        })

        it('only owner can withdraw Tokens', async () => {
            await expect(feeReceiver.connect(wallet).withdrawErc20Token(syaToken.address, revenueReceiver.address, 100)).to.be.revertedWith(
                'Ownable: caller is not the owner'
            )
            await expect(await syaToken.balanceOf(revenueReceiver.address)).to.eq(expandTo9Decimals(0))
            await syaToken.transfer(feeReceiver.address, expandTo9Decimals(100))
            await feeReceiver.withdrawErc20Token(syaToken.address, revenueReceiver.address, expandTo9Decimals(100))
            await expect(await syaToken.balanceOf(revenueReceiver.address)).to.eq(expandTo9Decimals(100))
        })
    })
})
