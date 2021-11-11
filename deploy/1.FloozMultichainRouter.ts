import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
require("dotenv").config();

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, execute } = deployments;

  const { deployer } = await getNamedAccounts();
  console.log("\n======== DEPLOYMENT STARTED ETH Mainnet ========");
  console.log("Using Deployer account: ", deployer);

  let multisigAddress, WETH, zeroEx
  if(network.name == 'eth_mainnet') {
    multisigAddress = "0xeF5a1c768eE7B51ec4B4Af3C5804349e70759E14";
    WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    zeroEx = "0xdef1c0ded9bec7f1a1670819833240f027b25eff";
  } else if (network.name == 'polygon') {
    multisigAddress = "";
    WETH = "";
    zeroEx = "";
  }
  
  const swapFee = 50; // 0.5 %
  const referralReward = 1000; // 10 %

  // deploy the fee receiver
  const feeReceiver = await deploy("FeeReceiverMultichain", {
    from: deployer,
    log: true,
    contract: "ReferralRegistry",
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
    args: [WETH, swapFee, referralReward, feeReceiver, referralRegistry.address, zeroEx],
  });

  // give the FloozRouter permission to create new anchors
  await execute("ReferralRegistry", { from: deployer, log: true }, "updateAnchorManager", floozRouter.address, true);

  // transfer Ownerships
  await execute("FloozRouter", { from: deployer, log: true }, "transferOwnership", multisigAddress);
  await execute("FeeReceiverMultichain", { from: deployer, log: true }, "transferOwnership", multisigAddress);
  await execute("ReferralRegistry", { from: deployer, log: true }, "transferOwnership", multisigAddress);
};

export default func;
func.tags = ["floozMultichainRouter"];
