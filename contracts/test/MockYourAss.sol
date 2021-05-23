pragma solidity 0.7.6;

// SPDX-License-Identifier: LGPL-3.0-or-newer
import "./ERC20Mintable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockYourAss is ERC20Mintable("MockYourAss", "MOCK") {}
