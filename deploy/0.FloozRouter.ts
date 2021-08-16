import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { expandTo9Decimals } from '../test/shared/utilities'
require('dotenv').config()

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre
    const { deploy, execute } = deployments

    const { deployer } = await getNamedAccounts()
    console.log('\n======== DEPLOYMENT STARTED ========')
    console.log('Using Deployer account: ', deployer)

    let WETH, syaToken, factoryV1, factoryV2, initCodeV1, initCodeV2, pancakeRouterV2, owner

    if (network.name == 'mainnet') {
        WETH = process.env.MAINNET_WETH
        syaToken = process.env.MAINNET_SYA
        factoryV1 = '0xBCfCcbde45cE874adCB698cC183deBcF17952812'
        factoryV2 = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73'
        initCodeV1 = '0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66'
        initCodeV2 = '0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5'
        pancakeRouterV2 = '0x10ED43C718714eb63d5aA57B78B54704E256024E'
        owner = '0x616b9E8ebf9cAc11E751713f3d765Cc22cC7d1D5'
    } else {
        WETH = process.env.TESTNET_WETH
        syaToken = process.env.TESTNET_SYA
        factoryV1 = process.env.TESTNET_PANCAKEFACTORY
        factoryV2 = process.env.TESTNET_PANCAKEFACTORY
        initCodeV1 = '0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66'
        initCodeV2 = '0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66'
        pancakeRouterV2 = '0x10ED43C718714eb63d5aA57B78B54704E256024E'
        owner = deployer
    }

    let swapFee = 50 // 0.5 %
    let referralReward = 1000 // 10 %
    let buybackRate = 5000 // 50%
    let balanceThreshold = expandTo9Decimals(5000000000) //5b SYA

    const feeReceiver = await deploy('FeeReceiver', {
        from: deployer,
        log: true,
        contract: 'FeeReceiver',
        args: [pancakeRouterV2, syaToken, WETH, owner, buybackRate],
    })

    const syaRouter = await deploy('SYARouter', {
        from: deployer,
        log: true,
        contract: 'FloozRouter',
        args: [WETH, swapFee, referralReward, feeReceiver.address, balanceThreshold, syaToken, factoryV1, factoryV2, initCodeV1, initCodeV2],
    })

    await execute('FeeReceiver', { from: deployer, log: true }, 'transferOwnership', owner)
    await execute('SYARouter', { from: deployer, log: true }, 'transferOwnership', owner)
}

export default func
func.tags = ['syp']
