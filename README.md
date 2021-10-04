# Flooz.trade Contracts

The flooz router which powers flooz.trade combines three different types of swaps in one router, so users only need to approve only one contract – the contracts are called from the flooz SDK (https://bitbucket.org/Lamine-23/flooz-trade-sdk/src/main/)

 - Swaps on 0x Protocol – Pathfinding via 0x API (https://0x.org/docs/api) through Flooz SDK with referral logic
 - Swaps directly through 0x API for god mode users without fees to save gas
 - Swaps through the Flooz router on uniswap-style DEXs to support Fees on Transfer (Not supported by 0x)

## Getting started
To run the tests, follow these steps. You must have at least node v10 and [yarn](https://yarnpkg.com/) installed.

First clone the repository:

```sh
git clone git@github.com:flooz-link/flooz-trade-contracts.git
```

Move into the flooz-trade-contracts working directory

```sh
cd flooz-trade-contracts/
```

Install dependencies

```sh
yarn
```

Building the contracts

```sh
yarn compile
```

Run tests

```sh
yarn test
```

## Deploying Contracts

Create a new .env file based from the example.env template in the main directory with the following variables:

```sh
INFURA_KEY=""
PRIVATE_KEY_MAINNET=""
PRIVATE_KEY_TESTNET=""
PRIVATE_KEY_LOCALHOST=""
ETHERSCAN_API_KEY=""

TESTNET_PANCAKEROUTER=""
TESTNET_PANCAKEFACTORY=""

MAINNET_PANCAKEROUTER=""
MAINNET_PANCAKEFACTORY=""
```

To deploy on Binance Smart Chain Testnet run:
```sh
yarn deploy:binance-testnet
```

To deploy on Binance Smart Chain Mainnet run:
```sh
yarn deploy:binance-mainnet
```