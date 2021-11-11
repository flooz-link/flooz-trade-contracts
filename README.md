

## Audit Notes

The existing contracts FloozRouter & FeeReceiver will continue to be used on Binance Smart Chain & faciliate the trades & buybacks.

In the next growth phase we'll be moving with our DeFi Wallet flooz.trade to additional networks:

 1. Ethereum Mainnet
 2. Polygon
 3. Avalanche
 4. Arbitrum & Optimism

For the next few weeks the token won't be migrated and continue to only life on BSC which makes it impossible to proof on-chain the token balance threshold for feeless trading. As a pragmatic approach for a short-time period the router contracts will be adjusted and expect a flag (true/false) which control if the given swaps pays fees or not. Our SDK will check the balance for the given wallet address on Binance Smart Chain and provides the matching flag. We're aware that this approach can easily be tricked and will be addressed with a more robust approach soon.


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