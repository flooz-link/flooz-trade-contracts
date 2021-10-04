<<<<<<< HEAD
import chai, { expect } from "chai";
import { Contract } from "ethers";
import { solidity, createFixtureLoader } from "ethereum-waffle";
import hre, { ethers, waffle } from "hardhat";
import { v2Fixture } from "./shared/fixtures";

chai.use(solidity);

describe("ReferralRegistry", () => {
  const [owner, wallet, referee, otherUser] = waffle.provider.getWallets();
  const loadFixture = createFixtureLoader([owner, referee]);

  let referralRegistry: Contract;

  beforeEach(async function () {
    const fixture = await loadFixture(v2Fixture);
    referralRegistry = fixture.referralRegistry;
  });

  describe("ReferralRegistry", () => {
    it("only anchor manager can create anchors", async () => {
      await expect(
        referralRegistry.connect(wallet).createReferralAnchor(wallet.address, referee.address)
      ).to.be.revertedWith("ReferralRegistry: FORBIDDEN");

      await expect(referralRegistry.createReferralAnchor(wallet.address, referee.address))
        .to.emit(referralRegistry, "ReferralAnchorCreated")
        .withArgs(wallet.address, referee.address);
    });

    it("only owner can update AnchorManager", async () => {
      expect(await referralRegistry.isAnchorManager(wallet.address)).to.eq(false);

      await expect(referralRegistry.connect(wallet).updateAnchorManager(wallet.address, true)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      await expect(referralRegistry.updateAnchorManager(wallet.address, true))
        .to.emit(referralRegistry, "AnchorManagerUpdated")
        .withArgs(wallet.address, true);

      expect(await referralRegistry.isAnchorManager(wallet.address)).to.eq(true);
    });

    it("only owner can update anchors", async () => {
      await expect(
        referralRegistry.connect(wallet).updateReferralAnchor(wallet.address, referee.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(referralRegistry.updateReferralAnchor(wallet.address, referee.address))
        .to.emit(referralRegistry, "ReferralAnchorUpdated")
        .withArgs(wallet.address, referee.address);
    });

    it("anchor manager can create anchors", async () => {
      expect(await referralRegistry.hasUserReferee(otherUser.address)).to.eq(false);
      expect(await referralRegistry.getUserReferee(otherUser.address)).to.eq(ethers.constants.AddressZero);

      await expect(referralRegistry.createReferralAnchor(otherUser.address, referee.address))
        .to.emit(referralRegistry, "ReferralAnchorCreated")
        .withArgs(otherUser.address, referee.address);

      expect(await referralRegistry.hasUserReferee(otherUser.address)).to.eq(true);
      expect(await referralRegistry.getUserReferee(otherUser.address)).to.eq(referee.address);
    });

    it("cannot create duplicate anchors", async () => {
      await expect(referralRegistry.createReferralAnchor(otherUser.address, referee.address)).to.be.revertedWith(
        "ReferralRegistry: ANCHOR_EXISTS"
      );
    });
  });
});
=======
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
>>>>>>> remotes/origin/master
