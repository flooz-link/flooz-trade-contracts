# Flooz.trade Contracts

## Deployed Contracts

| Contract |  Mainnet  | Testnet |
|--|--|--|
| FeeReceiver | [0x12b61B82f441bAD5A6E4dD86d74b92E8F15b930B](https://bscscan.com/address/0x12b61b82f441bad5a6e4dd86d74b92e8f15b930b) | [0xDa2E3f8D3F2d0df3E4F44d3f8c029bFC96CE627F](https://bscscan.com/address/0xDa2E3f8D3F2d0df3E4F44d3f8c029bFC96CE627F) |
| FloozRouter | [0x6A966b5C763ceB56C69AC85350C200E14C01CC86](https://bscscan.com/address/0x6A966b5C763ceB56C69AC85350C200E14C01CC86) | [0x1963F672d8009002dC08cdbc47fdE9949F571c2E](https://bscscan.com/address/0x4D0f9B917EF7a0x1963F672d8009002dC08cdbc47fdE9949F571c2E1A590C34B6f357147583C6ae47E) |
| ReferralRegistry | [0x7ed93Fea48B090DfB1f718b5B3B53E7339c321E5](https://bscscan.com/address/0x7ed93Fea48B090DfB1f718b5B3B53E7339c321E5) | [0xb47145c3FC2255f32a9792ca5B18D0B2C2D21772](https://bscscan.com/address/0xb47145c3FC2255f32a9792ca5B18D0B2C2D21772) |


## Audit
The audit report from Techrate can be found in the `assets` directory

## Getting started
To run the tests, follow these steps. You must have at least node v10 and [yarn](https://yarnpkg.com/) installed.

First clone the repository:

```sh
git clone git@bitbucket.org:Lamine-23/flooz-trade-contracts.git
```

Move into the flooz-trade-contracts working directory

```sh
cd flooz-trade-contracts/
```

Install dependencies

```sh
yarn install
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
yarn deploy:testnet
```

To deploy on Binance Smart Chain Mainnet run:
```sh
yarn deploy:mainnet
```