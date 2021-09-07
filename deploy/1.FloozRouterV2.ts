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

    const TestRouter = await deploy('TestRouter', {
        from: deployer,
        log: true,
        contract: 'TestRouter',
    })
}

export default func
func.tags = ['router2']
