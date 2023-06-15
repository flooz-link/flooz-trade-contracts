pragma solidity ^0.8.0;

interface IFloozMultiChainRouter {
    event SwapFeeUpdated(uint16 swapFee);
    event ReferralRegistryUpdated(address referralRegistry);
    event ReferralRewardRateUpdated(uint16 referralRewardRate);
    event ReferralsActivatedUpdated(bool activated);
    event FeeReceiverUpdated(address payable feeReceiver);
    event CustomReferralRewardRateUpdated(address indexed account, uint16 referralRate);
    event ReferralRewardPaid(address from, address indexed to, address tokenOut, address tokenReward, uint256 amount);
    event ForkCreated(address factory);
    event ForkUpdated(address factory);

    struct SwapData {
        address fork;
        address referee;
        bool fee;
    }

    struct ExternalSwapData {
        bytes data;
        address fromToken;
        address toToken;
        uint256 amountFrom;
        address referee;
        uint256 minOut;
        bool fee;
    }
}