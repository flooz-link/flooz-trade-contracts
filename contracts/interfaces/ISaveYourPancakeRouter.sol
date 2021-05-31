pragma solidity =0.6.6;

interface ISaveYourPancakeRouter {
    function swapExactTokensForTokens(
        address factory,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}
