import { Contract, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { expandTo18Decimals, expandTo9Decimals } from './utilities'

const overrides = {
    gasLimit: 9999999,
}

interface V2Fixture {
    token0: Contract
    token1: Contract
    syaToken: Contract
    WETH: Contract
    WETHPartner: Contract
    factoryV2: Contract
    router: Contract
    pair: Contract
    WETHPair: Contract
    routerEventEmitter: Contract
    feeReceiver: Contract
    pancakeRouterV2: Contract
    syaPair: Contract
    dtt: Contract
}

export async function v2Fixture([wallet]: Wallet[]): Promise<V2Fixture> {
    let swapFee = 50 // 0.5 %
    let referralFee = 1000 // 10 % of swapFee
    let balanceThreshold = expandTo9Decimals(100000000) // 1000 SYA
    let ERC20 = await ethers.getContractFactory('ERC20')
    let SYA = await ethers.getContractFactory('SYAMOCK')
    let WETH9 = await ethers.getContractFactory('WETH9')
    let FloozRouter = await ethers.getContractFactory('FloozRouter')
    let ReferralRegistry = await ethers.getContractFactory('ReferralRegistry')
    let PancakeFactory = await ethers.getContractFactory('PancakeFactory')
    let RouterEventEmitter = await ethers.getContractFactory('RouterEventEmitter')
    let FeeReceiver = await ethers.getContractFactory('FeeReceiver')
    let PancakeRouterV2 = await ethers.getContractFactory('PancakeRouter')
    let Dtt = await ethers.getContractFactory('DeflatingERC20')

    // deploy tokens
    const tokenA = await ERC20.deploy(expandTo18Decimals(10000))
    const tokenB = await ERC20.deploy(expandTo18Decimals(10000))
    const syaToken = await SYA.deploy(expandTo9Decimals(10000))
    const WETH = await WETH9.deploy()
    const WETHPartner = await ERC20.deploy(expandTo18Decimals(10000))
    const dtt = await Dtt.deploy(expandTo18Decimals(10000))

    // deploy Pancake V2
    const factoryV2 = await PancakeFactory.deploy(wallet.address)
    const initHash = await factoryV2.INIT_CODE_PAIR_HASH()
    const pancakeRouterV2 = await PancakeRouterV2.deploy(factoryV2.address, WETH.address)
    console.log('INIT_CODE_PAIR_HASH:', initHash)

    // deploy Fee Receiver
    const revenueReceiver = wallet.address
    const feeReceiver = await FeeReceiver.deploy(pancakeRouterV2.address, syaToken.address, WETH.address, revenueReceiver, 5000)

    // deploy referral registry
    const referralRegistry = await ReferralRegistry.deploy()

    // deploy Flooz router
    const router = await FloozRouter.deploy(
        WETH.address,
        swapFee,
        referralFee,
        feeReceiver.address,
        balanceThreshold,
        syaToken.address,
        factoryV2.address,
        factoryV2.address,
        initHash,
        initHash,
        referralRegistry.address
    )

    // grant flooz router anchor manager privilege to register anchors
    await referralRegistry.updateAnchorManager(router.address, true)

    // event emitter for testing
    const routerEventEmitter = await RouterEventEmitter.deploy()

    // initialize V2
    await factoryV2.createPair(tokenA.address, tokenB.address)
    const pairAddress = await factoryV2.getPair(tokenA.address, tokenB.address)
    const pair = await ethers.getContractAt('PancakePair', pairAddress)

    const token0Address = await pair.token0()
    const token0 = tokenA.address === token0Address ? tokenA : tokenB
    const token1 = tokenA.address === token0Address ? tokenB : tokenA

    await factoryV2.createPair(WETH.address, WETHPartner.address)
    const WETHPairAddress = await factoryV2.getPair(WETH.address, WETHPartner.address)
    const WETHPair = await ethers.getContractAt('PancakePair', WETHPairAddress)

    await factoryV2.createPair(WETH.address, syaToken.address)
    const syaPairAddress = await factoryV2.getPair(WETH.address, syaToken.address)
    const syaPair = await ethers.getContractAt('PancakePair', syaPairAddress)

    await factoryV2.createPair(WETH.address, dtt.address)

    return {
        token0,
        token1,
        syaToken,
        WETH,
        WETHPartner,
        factoryV2,
        router,
        pair,
        WETHPair,
        routerEventEmitter,
        feeReceiver,
        pancakeRouterV2,
        syaPair,
        dtt,
    }
}
