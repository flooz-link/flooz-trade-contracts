import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { expandTo9Decimals } from "../test/shared/utilities";
require("dotenv").config();

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, execute } = deployments;

  const { deployer } = await getNamedAccounts();
  console.log("\n======== DEPLOYMENT STARTED ========");
  console.log("Using Deployer account: ", deployer);

  let WETH, syaToken, factoryV1, factoryV2, initCodeV1, initCodeV2, pancakeRouterV2, contractOwner;

  const zeroEx = "0xdef1c0ded9bec7f1a1670819833240f027b25eff";

  if (network.name == "mainnet") {
    WETH = process.env.MAINNET_WETH;
    syaToken = process.env.MAINNET_SYA;
    factoryV1 = "0xBCfCcbde45cE874adCB698cC183deBcF17952812";
    factoryV2 = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
    initCodeV1 = "0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66";
    initCodeV2 = "0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5";
    pancakeRouterV2 = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
    contractOwner = "0x616b9E8ebf9cAc11E751713f3d765Cc22cC7d1D5";
  } else {
    WETH = process.env.TESTNET_WETH;
    syaToken = process.env.TESTNET_SYA;
    factoryV1 = process.env.TESTNET_PANCAKEFACTORY;
    factoryV2 = process.env.TESTNET_PANCAKEFACTORY;
    initCodeV1 = "0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66";
    initCodeV2 = "0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66";
    pancakeRouterV2 = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
    contractOwner = deployer;
  }

  let swapFee = 50; // 0.5 %
  let referralReward = 1000; // 10 %
  let buybackRate = 5000; // 50%
  let balanceThreshold = expandTo9Decimals(5000000000); //5b SYA

  const feeReceiver = await deploy("FeeReceiver", {
    from: deployer,
    log: true,
    contract: "FeeReceiver",
    args: [pancakeRouterV2, syaToken, WETH, contractOwner, buybackRate],
  });

  const referralRegistry = await deploy("ReferralRegistry", {
    from: deployer,
    log: true,
    contract: "ReferralRegistry",
  });

  const floozRouter = await deploy("TestRouter", {
    from: deployer,
    log: true,
    contract: "TestRouter",
    args: [
      WETH,
      swapFee,
      referralReward,
      feeReceiver.address,
      balanceThreshold,
      syaToken,
      referralRegistry.address,
      zeroEx,
    ],
  });

  // grant permission for new router to set referralAnchors
  await execute("ReferralRegistry", { from: deployer, log: true }, "updateAnchorManager", floozRouter.address, true);

  // register Pancakeswap V1
  await execute("TestRouter", { from: deployer, log: true }, "registerFork", factoryV1, initCodeV1);

  // register Pancakeswap V2
  await execute("TestRouter", { from: deployer, log: true }, "registerFork", factoryV2, initCodeV2);

  //await execute("FeeReceiver", { from: deployer, log: true }, "transferOwnership", contractOwner);
  //await execute("TestRouter", { from: deployer, log: true }, "transferOwnership", contractOwner);
};

export default func;
func.tags = ["floozRouter"];
