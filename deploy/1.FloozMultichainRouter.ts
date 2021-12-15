import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
require("dotenv").config();

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, execute } = deployments;

  const { deployer } = await getNamedAccounts();
  console.log("\n======== DEPLOYMENT STARTED MULTICHAIN ========");
  console.log("Using Deployer account: ", deployer);

  const ETH_MULTISIG = "0xeF5a1c768eE7B51ec4B4Af3C5804349e70759E14";
  const WETH = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";
  const zeroEx = "0xdef1c0ded9bec7f1a1670819833240f027b25eff";
  const oneInch = "0x1111111254fb6c44bAC0beD2854e76F90643097d";
  const swapFee = 50; // 0.5 %
  const referralReward = 1000; // 10 %

  // deploy the fee receiver
  const feeReceiver = await deploy("FeeReceiverMultichain", {
    from: deployer,
    log: true,
    contract: "FeeReceiverMultichain",
    args: [WETH],
  });

  // deploy the referral registry
  const referralRegistry = await deploy("ReferralRegistry", {
    from: deployer,
    log: true,
    contract: "ReferralRegistry",
  });

  
  // deploy the router
  const floozRouter = await deploy("MultichainRouter", {
    from: deployer,
    log: true,
    contract: "MultichainRouter",
    args: [WETH, swapFee, referralReward, feeReceiver.address, referralRegistry.address, zeroEx, oneInch],
  });
        
  // give the FloozRouter permission to create new anchors
  await execute("ReferralRegistry", { from: deployer, log: true }, "updateAnchorManager", floozRouter.address, true);

  // transfer Ownerships
  //await execute("FloozRouter", { from: deployer, log: true }, "transferOwnership", ETH_MULTISIG);
  //await execute("FeeReceiverMultichain", { from: deployer, log: true }, "transferOwnership", ETH_MULTISIG);
  //await execute("ReferralRegistry", { from: deployer, log: true }, "transferOwnership", ETH_MULTISIG);
};

export default func;
func.tags = ["floozMultichainRouter"];
