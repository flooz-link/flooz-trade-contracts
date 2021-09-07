import chai, { expect } from 'chai'
import { BigNumber, constants, Contract, utils } from 'ethers'
import { solidity, createFixtureLoader } from 'ethereum-waffle'
import hre, { ethers, waffle } from 'hardhat'

import { v2Fixture } from './shared/fixtures'

chai.use(solidity)

const overrides = {
    gasLimit: 9999999,
}

describe('ReferralRegistry', () => {
    const [owner, wallet, achorManager] = waffle.provider.getWallets()
    const loadFixture = createFixtureLoader([owner])

    let referralRegistry: Contract
    let router: Contract

    beforeEach(async function () {
        const fixture = await loadFixture(v2Fixture)
        referralRegistry = fixture.referralRegistry
        router = fixture.router
    })

    it('only anchor manager can create anchors', async () => {
        await expect(referralRegistry.connect(owner).createReferralAnchor(wallet.address, owner.address)).to.be.revertedWith(
            'ReferralRegistry: FORBIDDEN'
        )

        await referralRegistry.updateAnchorManager(achorManager.address, true)
        await expect(await referralRegistry.connect(achorManager).createReferralAnchor(wallet.address, owner.address))
            .to.emit(referralRegistry, 'ReferralAnchorCreated')
            .withArgs(wallet.address, owner.address)

        await referralRegistry.updateAnchorManager(achorManager.address, false)

        await expect(referralRegistry.connect(owner).createReferralAnchor(wallet.address, owner.address)).to.be.revertedWith(
            'ReferralRegistry: FORBIDDEN'
        )
        await referralRegistry.updateAnchorManager(achorManager.address, true)
    })

    it('reverts if trying to create anchors twice', async () => {
        await expect(referralRegistry.connect(achorManager).createReferralAnchor(wallet.address, owner.address)).to.be.revertedWith(
            'ReferralRegistry: ANCHOR_EXISTS'
        )
    })

    it('only owner can update anchors', async () => {
        await expect(referralRegistry.connect(wallet).updateReferralAnchor(wallet.address, owner.address)).to.be.revertedWith(
            'Ownable: caller is not the owner'
        )

        await expect(await referralRegistry.connect(owner).updateReferralAnchor(wallet.address, owner.address))
            .to.emit(referralRegistry, 'ReferralAnchorUpdated')
            .withArgs(wallet.address, owner.address)
    })

    describe('View functions', () => {
        it('returns referee correcly', async () => {
            expect(await referralRegistry.getUserReferee(achorManager.address)).to.eq(ethers.constants.AddressZero)
            expect(await referralRegistry.hasUserReferee(achorManager.address)).to.eq(false)

            expect(await referralRegistry.getUserReferee(wallet.address)).to.eq(owner.address)
            expect(await referralRegistry.hasUserReferee(wallet.address)).to.eq(true)

            await referralRegistry.connect(owner).updateReferralAnchor(wallet.address, ethers.constants.AddressZero)
            expect(await referralRegistry.getUserReferee(wallet.address)).to.eq(ethers.constants.AddressZero)
            expect(await referralRegistry.hasUserReferee(wallet.address)).to.eq(false)
        })
    })
})
