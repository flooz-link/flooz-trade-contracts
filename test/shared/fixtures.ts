import { Contract, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { expandTo18Decimals } from './utilities'

const overrides = {
    gasLimit: 9999999,
}

interface V2Fixture {
    token0: Contract
    token1: Contract
    WETH: Contract
    WETHPartner: Contract
    factoryV2: Contract
    router: Contract
    pair: Contract
    WETHPair: Contract
    routerEventEmitter: Contract
}

export async function v2Fixture([wallet]: Wallet[]): Promise<V2Fixture> {
    let swapFee = 100
    let feeReceiver = wallet.address
    let balanceThreshold = expandTo18Decimals(10000)
    let ERC20 = await ethers.getContractFactory('ERC20')
    let WETH9 = await ethers.getContractFactory('WETH9')
    let SaveYourPancakeRouter = await ethers.getContractFactory('SaveYourPancakeRouter')
    let PancakeFactory = await ethers.getContractFactory('PancakeFactory')
    let RouterEventEmitter = await ethers.getContractFactory('RouterEventEmitter')

    // deploy tokens
    const tokenA = await ERC20.deploy(expandTo18Decimals(10000))
    const tokenB = await ERC20.deploy(expandTo18Decimals(10000))
    const WETH = await WETH9.deploy()
    const WETHPartner = await ERC20.deploy(expandTo18Decimals(10000))

    // deploy V2
    const factoryV2 = await PancakeFactory.deploy(wallet.address)
    console.log('INIT_CODE_PAIR_HASH:', await factoryV2.INIT_CODE_PAIR_HASH())

    // deploy router
    const router = await SaveYourPancakeRouter.deploy(
        factoryV2.address,
        WETH.address,
        swapFee,
        feeReceiver,
        balanceThreshold,
        tokenA.address,
        overrides
    )

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

    return {
        token0,
        token1,
        WETH,
        WETHPartner,
        factoryV2,
        router,
        pair,
        WETHPair,
        routerEventEmitter,
    }
}
