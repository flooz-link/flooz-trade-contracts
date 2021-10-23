import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
require("dotenv").config();

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, execute } = deployments;

  const { deployer } = await getNamedAccounts();
  console.log("\n======== DEPLOYMENT STARTED ETH Mainnet ========");
  console.log("Using Deployer account: ", deployer);

  const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
  const zeroEx = "0xdef1c0ded9bec7f1a1670819833240f027b25eff";
  const swapFee = 50; // 0.5 %
  const referralReward = 1000; // 10 %
  const feeReceiver = deployer;

  const referralRegistry = await deploy("ReferralRegistry", {
    from: deployer,
    log: true,
    contract: "ReferralRegistry",
  });

  const floozRouter = await deploy("TestMultichainRouter", {
    from: deployer,
    log: true,
    contract: "TestMultichainRouter",
    args: [WETH, swapFee, referralReward, feeReceiver, referralRegistry.address, zeroEx],
  });

  await execute("ReferralRegistry", { from: deployer, log: true }, "updateAnchorManager", floozRouter.address, true);
  //await execute("FloozRouter", { from: deployer, log: true }, "transferOwnership", contractOwner);
};

export default func;
func.tags = ["floozMultichainRouter"];
