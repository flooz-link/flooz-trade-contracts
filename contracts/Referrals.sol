pragma solidity ^0.8.0;
//SPDX-License-Identifier: Unlicense

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./libraries/TransferHelper.sol";

contract Referral is Pausable, Ownable {
    using SafeMath for uint256;

    event NewReferralReward(address referee, address token, uint256 amount);
    event RewardsClaimed(address token, address account, uint256 amount);

    mapping(address => mapping(address => uint256)) public unclaimedRewards;
    address public sypRouter;

    constructor(address _sypRouter) {
        sypRouter = _sypRouter;
    }

    function registerReferral(
        address _referee,
        address _token,
        uint256 _amount
    ) external payable whenNotPaused() onlyRouter() {
        if (_token == address(0)) {
            require(msg.value >= _amount, "Referrals: INVALID_AMOUNT");
        } else {
            TransferHelper.safeTransferFrom(_token, msg.sender, address(this), _amount);
        }
        unclaimedRewards[_referee][_token] = unclaimedRewards[_referee][_token].add(_amount);
        emit NewReferralReward(_referee, _token, _amount);
    }

    function claimRewards(address[] calldata _tokens) external whenNotPaused() {
        for (uint256 i = 0; i < _tokens.length; i++) {
            uint256 rewards = unclaimedRewards[msg.sender][_tokens[i]];
            unclaimedRewards[msg.sender][_tokens[i]] = 0;
            if (_tokens[i] == address(0)) {
                TransferHelper.safeTransferETH(msg.sender, rewards);
            } else {
                TransferHelper.safeTransfer(_tokens[i], msg.sender, rewards);
            }
            emit RewardsClaimed(_tokens[i], msg.sender, rewards);
        }
    }

    modifier onlyRouter() {
        require(msg.sender == sypRouter, "Referrals: FORBIDDEN");
        _;
    }
}
