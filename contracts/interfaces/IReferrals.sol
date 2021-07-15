pragma solidity ^0.8.0;

//SPDX-License-Identifier: Unlicense

interface IReferrals {
    function registerReferral(
        address _referee,
        address _token,
        uint256 _amount
    ) external payable;
}
