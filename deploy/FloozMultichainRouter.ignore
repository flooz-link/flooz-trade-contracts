import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
require("dotenv").config();

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, execute } = deployments;

  const { deployer } = await getNamedAccounts();
  console.log("\n======== DEPLOYMENT STARTED MULTICHAIN ========");
  console.log("Using Deployer account: ", deployer);

  let MULTISIG;
  const WETH = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";
  const zeroEx = "0xdef1c0ded9bec7f1a1670819833240f027b25eff";
  const oneInch = "0x1111111254fb6c44bAC0beD2854e76F90643097d";
  const swapFee = 50; // 0.5 %
  const referralReward = 1000; // 10 %
  if (network.name == "bsc_mainnet") {
    MULTISIG = "0x616b9E8ebf9cAc11E751713f3d765Cc22cC7d1D5";
  } else if (network.name == "eth_mainnet") {
    MULTISIG = "0xeF5a1c768eE7B51ec4B4Af3C5804349e70759E14";
  } else if (network.name == "polygon") {
    MULTISIG = "0xacA1eCf2F6b0aff85D1B58231cDE35b56098F2c2";
  } else if (network.name == "avalanche") {
    MULTISIG = "0x8189E1d1846227bcd500613d683652c46B28b7bB";
  }

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
  const floozRouter = await deploy("FloozMultichainRouter", {
    from: deployer,
    log: true,
    contract: "FloozMultichainRouter",
    args: [WETH, swapFee, referralReward, feeReceiver.address, referralRegistry.address, zeroEx, oneInch],
  });

  // give the FloozRouter permission to create new anchors
  await execute("ReferralRegistry", { from: deployer, log: true }, "updateAnchorManager", floozRouter.address, true);

  // transfer Ownerships
  //await execute("FloozRouter", { from: deployer, log: true }, "transferOwnership", MULTISIG);
  await execute("FeeReceiverMultichain", { from: deployer, log: true }, "transferOwnership", MULTISIG);
  await execute("ReferralRegistry", { from: deployer, log: true }, "transferOwnership", MULTISIG);
};

export default func;
func.tags = ["floozMultichainRouter"];
