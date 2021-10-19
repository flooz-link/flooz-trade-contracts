# Flooz.trade Contracts

The Flooz Router powers trades on flooz.trade with an integrated referral system and combines different swap types into one compact router.

## Getting started
To run the tests, follow these steps. You must have at least node v10 and [yarn](https://yarnpkg.com/) installed.

First clone the repository:y

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