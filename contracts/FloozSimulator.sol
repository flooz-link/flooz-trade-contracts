pragma solidity =0.6.6;

// SPDX-License-Identifier: UNLICENSED
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FloozSimulator {
    uint256 MAX_AMOUNT = 2 ^ (256 - 1);

    // WARNING: Do not send a transaction to this function, only meant for reading.
    function simulate(
        address to,
        address token,
        uint256 value,
        bytes calldata data
    ) external returns (bool success, bytes memory returnValue) {
        IERC20(token).approve(address(this), MAX_AMOUNT);
        (success, returnValue) = to.call{value: value}(data);
    }
}
