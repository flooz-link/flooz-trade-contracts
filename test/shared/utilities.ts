import { BigNumber } from 'ethers'
import { network, ethers } from 'hardhat'

export function expandTo18Decimals(n: number): BigNumber {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
}

export function expandTo9Decimals(n: number): BigNumber {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(9))
}

export async function mineBlock(timestamp: number) {
    await network.provider.request({
        method: 'evm_mine',
        params: [timestamp],
    })
}

export async function latestBlockTimestamp() {
    const block = await ethers.provider.getBlock('latest')
    return block.timestamp
}
