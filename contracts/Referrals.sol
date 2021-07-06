pragma solidity =0.6.6;

// SPDX-License-Identifier: UNLICENSED
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./libraries/TransferHelper.sol";

contract Referral is Pausable, Ownable {
    using SafeMath for uint256;

    event NewReferralReward(address token, uint256 amount);
    event RewardsClaimed(address account, uint256 amount);

    mapping(address => mapping(address => uint256)) unclaimedRewards;
    address public sypRouter;

    constructor(address _sypRouter) public {
        sypRouter = _sypRouter;
    }

    function registerReferral(address _token, uint256 _amount) external whenNotPaused() onlyRouter() {
        if (_token == address(0)) {
            _registerReferralETH(_amount);
        } else {
            _registerReferralERC20(_token, _amount);
        }
        emit NewReferralReward(_token, _amount);
    }

    function claimRewards(address[] calldata _tokens) external {
        for (uint256 i = 0; i < _tokens.length; i++) {
            uint256 rewards = unclaimedRewards[msg.sender][_tokens[i]];
            unclaimedRewards[msg.sender][_tokens[i]] = 0;
            if (_tokens[i] == address(0)) {
                TransferHelper.safeTransferETH(msg.sender, rewards);
            } else {
                TransferHelper.safeTransfer(_tokens[i], msg.sender, rewards);
            }
            emit RewardsClaimed(msg.sender, rewards);
        }
    }

    function _registerReferralETH(uint256 _amount) internal whenNotPaused() {
        unclaimedRewards[msg.sender][address(0)] = unclaimedRewards[msg.sender][address(0)].add(_amount);
    }

    function _registerReferralERC20(address _token, uint256 _amount) internal whenNotPaused() {
        unclaimedRewards[msg.sender][_token] = unclaimedRewards[msg.sender][_token].add(_amount);
    }

    modifier onlyRouter() {
        require(msg.sender == sypRouter, "Referral: FORBIDDEN");
        _;
    }

    receive() external payable {}
}
