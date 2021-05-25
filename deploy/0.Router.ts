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

    let pancakeFactory, WETH, syaToken
    if (network.name == 'mainnet') {
        pancakeFactory = process.env.MAINNET_PANCAKEFACTORY
        WETH = process.env.MAINNET_WETH
        syaToken = process.env.MAINNET_SYA
    } else {
        pancakeFactory = process.env.TESTNET_PANCAKEFACTORY
        WETH = process.env.TESTNET_WETH
        syaToken = process.env.TESTNET_SYA
    }

    let swapFee = 10 // 0.1 %
    let feeReceiver = '0xB282ba7E94589DC3bc980B7E5759Dcb791231393'
    let balanceThreshold = expandTo9Decimals(10000)

    const weth = await deploy('SYARouter', {
        from: deployer,
        log: true,
        contract: 'TestingRouter',
        args: [pancakeFactory, WETH, swapFee, feeReceiver, balanceThreshold, syaToken],
    })
}

export default func
func.tags = ['mocks']
