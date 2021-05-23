import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
require('dotenv').config()

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre
    const { deploy, execute } = deployments

    const { deployer } = await getNamedAccounts()
    console.log('\n======== DEPLOYMENT STARTED ========')
    console.log('Using Deployer account: ', deployer)

    let WETH = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'
    let pancakeFactory = process.env.MAINNET_PANCAKEFACTORY
    let swapFee = 100
    let feeReceiver = '0xB282ba7E94589DC3bc980B7E5759Dcb791231393'

    console.log('\n======== MOCKS ========')
    const weth = await deploy('SYARouter', {
        from: deployer,
        log: true,
        contract: 'TestingRouter',
        args: [pancakeFactory, WETH, swapFee, feeReceiver],
    })
}

export default func
func.tags = ['mocks']
