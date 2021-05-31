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

    let WETH, syaToken, factoryV1, factoryV2, initCodeV1, initCodeV2
    if (network.name == 'mainnet') {
        WETH = process.env.MAINNET_WETH
        syaToken = process.env.MAINNET_SYA
    } else {
        WETH = process.env.TESTNET_WETH
        syaToken = process.env.TESTNET_SYA
        factoryV1 = process.env.TESTNET_PANCAKEFACTORY
        factoryV2 = process.env.TESTNET_PANCAKEFACTORY
        initCodeV1 = '0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66'
        initCodeV2 = '0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66'
    }

    let swapFee = 10 // 0.1 %
    let feeReceiver = '0xB282ba7E94589DC3bc980B7E5759Dcb791231393'
    let balanceThreshold = expandTo9Decimals(10000)

    const weth = await deploy('SYARouter', {
        from: deployer,
        log: true,
        contract: 'SaveYourPancakeRouter',
        args: [WETH, swapFee, feeReceiver, balanceThreshold, syaToken, factoryV1, factoryV2, initCodeV1, initCodeV2],
    })
}

export default func
func.tags = ['mocks']
