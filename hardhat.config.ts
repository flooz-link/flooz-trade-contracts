import '@nomiclabs/hardhat-truffle5'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-deploy'
import 'solidity-coverage'
import '@nomiclabs/hardhat-etherscan'
import 'hardhat-gas-reporter'
import 'hardhat-dependency-compiler'
import 'hardhat-typechain'
import 'hardhat-tracer'
import 'hardhat-log-remover'

require('dotenv').config()

module.exports = {
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {
            live: false,
            tags: ['local'],
            allowUnlimitedContractSize: true,
            accounts: {
                accountsBalance: '100000000000000000000000',
            },
        },
        testnet: {
            live: true,
            tags: ['testnet'],
            allowUnlimitedContractSize: true,
            url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
            chainId: 97,
            gasPrice: 20000000000,
            accounts: [process.env.PRIVATE_KEY_TESTNET],
        },
        mainnet: {
            live: true,
            tags: ['mainnet'],
            url: 'https://bsc-dataseed1.defibit.io/',
            chainId: 56,
            gasPrice: 30000000000,
            accounts: [process.env.PRIVATE_KEY_MAINNET],
        },
        localhost: {
            live: false,
            tags: ['local'],
            url: 'http://127.0.0.1:8547',
            accounts: [process.env.PRIVATE_KEY_LOCALHOST],
            allowUnlimitedContractSize: true,
        },
    },
    mocha: {
        timeout: '10000000s',
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
                version: '0.7.6',
            },
            {
                version: '0.5.16',
            },
            {
                version: '0.6.6',
            },
        ],
        settings: {
            outputSelection: {
                '*': {
                    '*': ['storageLayout'],
                },
            },
            metadata: {
                bytecodeHash: 'none',
            },
        },
    },
    dependencyCompiler: {
        paths: ['pancakeswap-peripheral/contracts/test/WETH9.sol'],
    },
    gasReporter: {
        currency: 'USD',
        enabled: false,
        gasPrice: 6,
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        admin: {
            default: 1,
        },
        karen: {
            default: 2,
        },
        bob: {
            default: 3,
        },
        randy: {
            default: 4,
        },
        stan: {
            default: 5,
        },
        ultraWhale: {
            default: 6,
        },
        whale: {
            default: 7,
        },
        fish: {
            default: 8,
        },
        shrimp: {
            default: 9,
        },
    },
}
