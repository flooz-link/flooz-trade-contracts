pragma solidity 0.7.6;

pragma abicoder v2;
// SPDX-License-Identifier: LGPL-3.0-or-newer
import "../token/SaveYourAssets.sol";

contract SaveYourAssetsTest is SaveYourAssets {
    using SafeMath for uint256;

    constructor(address router) SaveYourAssets(router) {}

    function getTaxes() external view onlyOwner returns (uint32) {
        return _taxRates.burn;
    }

    function getExcludedReflectionAmount() external view onlyOwner returns (uint256) {
        return _stats.totalExcludedReflection;
    }

    function getReflectionRate() public view returns (uint256) {
        return calculateReflectionRate();
    }
}
