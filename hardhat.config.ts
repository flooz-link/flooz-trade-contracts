import '@nomiclabs/hardhat-truffle5'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-deploy'
import 'solidity-coverage'
import '@nomiclabs/hardhat-etherscan'
import 'hardhat-dependency-compiler'
import 'hardhat-typechain'
import 'hardhat-tracer'

require('dotenv').config()

module.exports = {
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {
            live: false,
            tags: ['local'],
            accounts: {
                accountsBalance: '100000000000000000000000',
            },
        },
        testnet: {
            url: 'https://data-seed-prebsc-2-s2.binance.org:8545',
            chainId: 97,
            accounts: [process.env.PRIVATE_KEY_TESTNET],
        },
        mainnet: {
            live: true,
            url: 'https://bsc-dataseed.binance.org/',
            chainId: 56,
            gasPrice: 5000000000,
            accounts: [process.env.PRIVATE_KEY_MAINNET],
        },
        localhost: {
            live: false,
            tags: ['local'],
            url: 'http://127.0.0.1:8547',
            accounts: [process.env.PRIVATE_KEY_LOCALHOST],
        },
    },
    mocha: {
        timeout: '100s',
    },
    paths: {
        artifacts: 'build/artifacts',
        cache: 'build/cache',
        deploy: 'deploy',
        deployments: 'deployments',
        sources: 'contracts',
    },
    solidity: {
        compilers: [
            {
                version: '0.8.0',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: '0.6.6',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: '0.5.16',
            },
        ],
    },
    dependencyCompiler: {
        paths: ['@pancakeswap-libs/pancake-swap-core/contracts/PancakeFactory.sol'],
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
    },
}
