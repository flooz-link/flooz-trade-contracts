import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
require("dotenv").config();

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network, upgrades, ethers } = hre;
  const { deploy, execute } = deployments;

  const { deployer } = await getNamedAccounts();
  console.log("\n======== DEPLOYMENT STARTED MULTICHAIN ========");
  console.log("Using Deployer account: ", deployer);

  const WETH = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
  const zeroEx = "0xdef1c0ded9bec7f1a1670819833240f027b25eff";
  const oneInch = "0x1111111254EEB25477B68fb85Ed929f73A960582";
  const swapFee = 50; // 0.5 %
  const referralReward = 1000; // 10 %

  const FloozMultichainRouter = await ethers.getContractFactory("FloozMultichainRouter");
  // deploy the router
  const floozRouterProxy = await upgrades.deployProxy(FloozMultichainRouter, [
      WETH,
      swapFee,
      referralReward,
      "0x12b61B82f441bAD5A6E4dD86d74b92E8F15b930B",
      "0x491AcC56B46B09b91CEA690C3D5c7be17e390fbB",
      zeroEx,
      oneInch,
    ]);

  await floozRouterProxy.deployed()

  console.log(`Deployed to: ${floozRouterProxy.address}`)

  // give the FloozRouter permission to create new anchors
  await execute(
    "ReferralRegistry",
    { from: deployer, log: true },
    "updateAnchorManager",
    floozRouterProxy.address,
    true
  );
};

export default func;
func.tags = ["floozMultichainRouterProxy"];
