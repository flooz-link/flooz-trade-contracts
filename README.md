# 🍑 SaveYourAss Contracts

## Deployed Contracts

|Contract|Address|
|--|--|
|Pre-Sale|[0x633C9cdaf779E1E391680525449e9BF4C0Bc4595](https://bscscan.com/address/0x633c9cdaf779e1e391680525449e9bf4c0bc4595)|
|Voucher Token|[0x75667d81FE26AC596D3E7eF97D51B49fe679Bec8](https://bscscan.com/address/0x75667d81FE26AC596D3E7eF97D51B49fe679Bec8)|
|SYA Token|[0x83A86adf1a7c56e77d36d585B808052e0a2aAD0e](https://bscscan.com/address/0x83A86adf1a7c56e77d36d585B808052e0a2aAD0e)|
|DevVault|[0xdf921B839C26671335Ea70bc52cC9750613BaC78](https://bscscan.com/address/0xdf921B839C26671335Ea70bc52cC9750613BaC78)|
|MarketingVault|[0xB282ba7E94589DC3bc980B7E5759Dcb791231393](https://bscscan.com/address/0xB282ba7E94589DC3bc980B7E5759Dcb791231393)|
|CharityVault|[0xC52F5A65DabF20c5f47995c34C3C9FbbEe66C08D](https://bscscan.com/address/0xC52F5A65DabF20c5f47995c34C3C9FbbEe66C08D)|
|FairLaunch|[0xDc7de598bF4894fbF61e40895C46d85d512d15F2](https://bscscan.com/address/0xDc7de598bF4894fbF61e40895C46d85d512d15F2)|
|CommunityBooster|[0xB0634C7bdB458c97976ad15481f1560B6A366fa0](https://bscscan.com/address/0xB0634C7bdB458c97976ad15481f1560B6A366fa0)|

**Audits**

[Audit1](/audits/audit_1.pdf) | [Audit 2](/audits/audit_2.pdf)

## Getting started
To run the tests, follow these steps. You must have at least node v10 and [yarn](https://yarnpkg.com/) installed.

First clone the repository:

```sh
git clone https://github.com/syahq/sya-contracts.git
```

Move into the saveyourass working directory

```sh
cd saveyourass-contracts/
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

Create a new .env file in the main directory with the following variables:

```sh
INFURA_KEY="xxx"
PRIVATE_KEY_MAINNET="xxx"
PRIVATE_KEY_TESTNET="xxx"
PRIVATE_KEY_LOCALHOST="xxx"
ETHERSCAN_API_KEY="xxx"
```

To deploy on Binance Smart Chain Testnet run:
```sh
yarn deploy:testnet
```

To deploy on Binance Smart Chain Mainnet run:
```sh
yarn deploy:mainnet
```