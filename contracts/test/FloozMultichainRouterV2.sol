pragma solidity =0.8.20;

import "../FloozMultichainRouter.sol";

contract FloozMultichainRouterV2 is FloozMultichainRouter {
    using SafeMathUpgradeable for uint256;

    ///@dev returns the contract version
   function version() external pure returns (uint256) {
       return 2;
   }
}
