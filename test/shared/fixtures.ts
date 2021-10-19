import { parseEther } from "@ethersproject/units";
import { Contract, Wallet } from "ethers";
import { ethers } from "hardhat";
import { expandTo18Decimals, expandTo9Decimals } from "./utilities";

const overrides = {
  gasLimit: 9999999,
};

interface V2Fixture {
  token0: Contract;
  token1: Contract;
  WETH: Contract;
  WETHPartner: Contract;
  factoryV2: Contract;
  router: Contract;
  pair: Contract;
  WETHPair: Contract;
  routerEventEmitter: Contract;
  feeReceiver: Contract;
  pancakeRouterV2: Contract;
  dtt: Contract;
  referralRegistry: Contract;
}

export async function v2Fixture([wallet, user, godModeUser]: Wallet[]): Promise<V2Fixture> {
  const zeroExContract = "0xdef1c0ded9bec7f1a1670819833240f027b25eff";
  let swapFee = 50; // 0.5 %
  let referralFee = 1000; // 10 % of swapFee
  let ERC20 = await ethers.getContractFactory("ERC20");
  let WETH9 = await ethers.getContractFactory("WETH9");
  let FloozRouter = await ethers.getContractFactory("FloozRouter");
  let ReferralRegistry = await ethers.getContractFactory("ReferralRegistry");
  let PancakeFactory = await ethers.getContractFactory("PancakeFactory");
  let RouterEventEmitter = await ethers.getContractFactory("RouterEventEmitter");
  let FeeReceiver = await ethers.getContractFactory("FeeReceiver");
  let PancakeRouterV2 = await ethers.getContractFactory("PancakeRouter");
  let Dtt = await ethers.getContractFactory("DeflatingERC20");

  // deploy tokens
  const tokenA = await ERC20.deploy(expandTo18Decimals(10000000));
  const tokenB = await ERC20.deploy(expandTo18Decimals(10000000));
  await tokenA.transfer(user.address, expandTo18Decimals(1000));
  await tokenB.transfer(user.address, expandTo18Decimals(1000));
  await tokenA.transfer(godModeUser.address, expandTo18Decimals(1000));
  await tokenB.transfer(godModeUser.address, expandTo18Decimals(1000));
  const WETH = await WETH9.deploy();
  const WETHPartner = await ERC20.deploy(expandTo18Decimals(10000000));
  await WETHPartner.transfer(user.address, expandTo18Decimals(1000));
  await WETHPartner.transfer(godModeUser.address, expandTo18Decimals(1000));
  const dtt = await Dtt.deploy(expandTo18Decimals(10000000));
  await dtt.transfer(user.address, expandTo18Decimals(1000));
  await dtt.transfer(godModeUser.address, expandTo18Decimals(1000));

  // deploy Pancake V2
  const factoryV2 = await PancakeFactory.deploy(wallet.address);
  const initHash = await factoryV2.INIT_CODE_PAIR_HASH();
  const pancakeRouterV2 = await PancakeRouterV2.deploy(factoryV2.address, WETH.address);
  //console.log("INIT_CODE_PAIR_HASH:", initHash);

  // deploy Fee Receiver
  const feeReceiver = await FeeReceiver.deploy(WETH.address);

  // deploy referral registry
  const referralRegistry = await ReferralRegistry.deploy();

  // deploy Flooz router
  const router = await FloozRouter.deploy(
    WETH.address,
    swapFee,
    referralFee,
    feeReceiver.address,
    referralRegistry.address,
    zeroExContract
  );
  await router.registerFork(factoryV2.address, initHash);

  // grant flooz router anchor manager privilege to register anchors
  await referralRegistry.updateAnchorManager(router.address, true);
  // grant owner anchor manager privilege to register anchors
  await referralRegistry.updateAnchorManager(wallet.address, true);

  // event emitter for testing
  const routerEventEmitter = await RouterEventEmitter.deploy();

  // initialize V2
  await factoryV2.createPair(tokenA.address, tokenB.address);
  const pairAddress = await factoryV2.getPair(tokenA.address, tokenB.address);
  const pair = await ethers.getContractAt("PancakePair", pairAddress);

  const token0Address = await pair.token0();
  const token0 = tokenA.address === token0Address ? tokenA : tokenB;
  const token1 = tokenA.address === token0Address ? tokenB : tokenA;

  await factoryV2.createPair(WETH.address, WETHPartner.address);
  const WETHPairAddress = await factoryV2.getPair(WETH.address, WETHPartner.address);
  const WETHPair = await ethers.getContractAt("PancakePair", WETHPairAddress);

  await factoryV2.createPair(WETH.address, dtt.address);

  return {
    token0,
    token1,
    WETH,
    WETHPartner,
    factoryV2,
    router,
    pair,
    WETHPair,
    routerEventEmitter,
    feeReceiver,
    pancakeRouterV2,
    dtt,
    referralRegistry,
  };
}
