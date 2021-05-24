pragma solidity >=0.7.6;

// SPDX-License-Identifier: LGPL-3.0-or-newer
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISaveYourSwapERC20 is IERC20 {
    function decimals() external view virtual returns (uint8);
}
