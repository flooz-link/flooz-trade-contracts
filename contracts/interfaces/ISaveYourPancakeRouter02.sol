pragma solidity >=0.7.6;

import "./ISaveYourPancakeRouter01.sol";

interface ISaveYourPancakeRouter02 is ISaveYourPancakeRouter01 {
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}
