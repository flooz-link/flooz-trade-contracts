pragma solidity ^0.8.0;
//SPDX-License-Identifier: Unlicense

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./libraries/TransferHelper.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/IReferrals.sol";
import "./interfaces/IPancakeRouter02.sol";
import "hardhat/console.sol";

contract FloozRouter is Ownable, Pausable {
    using SafeMath for uint256;
    event SwapFeeUpdated(uint8 swapFee);
    event FeeReceiverUpdated(address feeReceiver);
    event BalanceThresholdUpdated(uint256 balanceThreshold);

    uint256 public constant FEE_DENOMINATOR = 10000;
    address public immutable WETH;
    IERC20 public saveYourAssetsToken;
    uint256 public balanceThreshold;
    address public feeReceiver;
    uint8 public swapFee;

    mapping(address => bool) public routerWhitelist;

    modifier isValidReferral(address referee) {
        require(referee != msg.sender, "FloozRouter: SELF_REFERRAL");
        _;
    }

    modifier isValidRouter(address router) {
        require(routerWhitelist[router], "FloozRouter: INVALID_ROUTER");
        _;
    }

    constructor(
        address _WETH,
        uint8 _swapFee,
        address _feeReceiver,
        uint256 _balanceThreshold,
        IERC20 _saveYourAssetsToken,
        address[] memory _routerWhitelist
    ) {
        WETH = _WETH;
        swapFee = _swapFee;
        feeReceiver = _feeReceiver;
        saveYourAssetsToken = _saveYourAssetsToken;
        balanceThreshold = _balanceThreshold;
        for (uint256 i = 0; i < _routerWhitelist.length; i++) {
            routerWhitelist[_routerWhitelist[i]] = true;
        }
    }

    receive() external payable {}

    function swapExactETHForTokens(
        address router,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        address referee
    ) external payable whenNotPaused isValidReferral(referee) isValidRouter(router) returns (uint256[] memory amounts) {
        (uint256 swapAmount, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(msg.value, referee != address(0));

        amounts = IPancakeRouter02(router).swapExactETHForTokens{value: swapAmount}(amountOutMin, path, to, block.timestamp);
        if (feeAmount > 0) {
            _withdrawFeesAndRewards(address(0), referee, feeAmount, referralReward);
        }
    }

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        address router,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        address referee
    ) external whenNotPaused isValidReferral(referee) isValidRouter(router) {
        (uint256 swapAmount, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(amountIn, referee != address(0));
        IPancakeRouter02(router).swapExactTokensForETHSupportingFeeOnTransferTokens(swapAmount, amountOutMin, path, to, block.timestamp);

        if (feeAmount > 0) {
            _withdrawFeesAndRewards(path[0], referee, feeAmount, referralReward);
        }
    }

    function swapExactTokensForTokens(
        address router,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        address referee
    ) external whenNotPaused isValidReferral(referee) isValidRouter(router) returns (uint256[] memory amounts) {
        (uint256 swapAmount, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(amountIn, referee != address(0));
        amounts = IPancakeRouter02(router).swapExactTokensForTokens(swapAmount, amountOutMin, path, address(this), block.timestamp);
        if (feeAmount > 0) {
            _withdrawFeesAndRewards(path[0], referee, feeAmount, referralReward);
        }
    }

    function swapExactTokensForETH(
        address router,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        address referee
    ) external whenNotPaused isValidReferral(referee) isValidRouter(router) returns (uint256[] memory amounts) {
        TransferHelper.safeTransferFrom(path[0], msg.sender, address(this), amountIn);
        TransferHelper.safeApprove(path[0], router, amountIn);
        amounts = IPancakeRouter02(router).swapExactTokensForETH(amountIn, amountOutMin, path, address(this), block.timestamp);

        (uint256 withdrawAmount, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(
            amounts[amounts.length - 1],
            referee != address(0)
        );

        TransferHelper.safeTransferETH(msg.sender, withdrawAmount);
        if (feeAmount > 0) {
            _withdrawFeesAndRewards(address(0), referee, feeAmount, referralReward);
        }
    }

    function swapETHForExactTokens(
        address router,
        uint256 amountOut,
        address[] calldata path,
        address to,
        address referee
    ) external payable whenNotPaused isValidReferral(referee) isValidRouter(router) returns (uint256[] memory amounts) {
        (uint256 swapAmount, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(msg.value, referee != address(0));
        amounts = IPancakeRouter02(router).swapETHForExactTokens{value: swapAmount}(amountOut, path, to, block.timestamp);
        if (feeAmount > 0) {
            _withdrawFeesAndRewards(address(0), referee, feeAmount, referralReward);
        }
    }

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        address router,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        address referee
    ) external whenNotPaused isValidReferral(referee) isValidRouter(router) {
        (uint256 swapAmount, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(amountIn, referee != address(0));
        IPancakeRouter02(router).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            swapAmount,
            amountOutMin,
            path,
            address(this),
            block.timestamp
        );

        if (feeAmount > 0) {
            _withdrawFeesAndRewards(path[0], referee, feeAmount, referralReward);
        }
    }

    function swapTokensForExactTokens(
        address router,
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        address referee
    ) external whenNotPaused isValidReferral(referee) isValidRouter(router) returns (uint256[] memory amounts) {
        amounts = IPancakeRouter02(router).swapTokensForExactTokens(amountOut, amountInMax, path, address(this), block.timestamp);

        (uint256 withdrawAmount, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(
            amounts[amounts.length - 1],
            referee != address(0)
        );

        TransferHelper.safeTransfer(path[path.length - 1], msg.sender, withdrawAmount);
        if (feeAmount > 0) {
            _withdrawFeesAndRewards(path[0], referee, feeAmount, referralReward);
        }
    }

    function swapTokensForExactETH(
        address router,
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        address referee
    ) external whenNotPaused isValidReferral(referee) isValidRouter(router) returns (uint256[] memory amounts) {
        amounts = IPancakeRouter02(router).swapTokensForExactETH(amountOut, amountInMax, path, address(this), block.timestamp);

        (uint256 swapAmount, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(
            amounts[amounts.length - 1],
            referee != address(0)
        );

        TransferHelper.safeTransferETH(msg.sender, swapAmount);
        if (feeAmount > 0) {
            _withdrawFeesAndRewards(path[0], referee, feeAmount, referralReward);
        }
    }

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        address router,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        address referee
    ) external payable whenNotPaused isValidReferral(referee) isValidRouter(router) {
        (uint256 swapAmount, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(msg.value, referee != address(0));

        IPancakeRouter02(router).swapExactETHForTokensSupportingFeeOnTransferTokens{value: swapAmount}(
            amountOutMin,
            path,
            address(this),
            block.timestamp
        );

        if (feeAmount > 0) {
            _withdrawFeesAndRewards(address(0), referee, feeAmount, referralReward);
        }
    }

    function _calculateFeesAndRewards(uint256 amount, bool isReferral)
        internal
        view
        returns (
            uint256 swapAmount,
            uint256 feeAmount,
            uint256 referralReward
        )
    {
        if (userAboveBalanceThreshold(msg.sender)) {
            referralReward = 0;
            feeAmount = 0;
            swapAmount = amount;
        } else {
            uint256 fees = amount.mul(swapFee).div(FEE_DENOMINATOR);
            swapAmount = amount.sub(fees);
            if (isReferral) {
                feeAmount = fees.div(2);
                referralReward = swapAmount.sub(feeAmount);
            } else {
                referralReward = 0;
                feeAmount = fees;
            }
        }
    }

    function _withdrawFeesAndRewards(
        address token,
        address referee,
        uint256 feeAmount,
        uint256 referralReward
    ) internal {
        if (token == address(0)) {
            TransferHelper.safeTransferETH(feeReceiver, feeAmount);
            if (referralReward > 0) {
                //referralManager.registerReferral{value: referralReward}(referee, token, referralReward);
            }
        } else {
            TransferHelper.safeTransfer(token, feeReceiver, feeAmount);
            if (referralReward > 0) {
                //IERC20(token).approve(address(referralManager), referralReward);
                //referralManager.registerReferral(referee, token, referralReward);
            }
        }
    }

    function getUserFee(address user) public view returns (uint256) {
        return saveYourAssetsToken.balanceOf(user) >= balanceThreshold ? 0 : swapFee;
    }

    function updateSwapFee(uint8 newSwapFee) external onlyOwner {
        swapFee = newSwapFee;
        emit SwapFeeUpdated(newSwapFee);
    }

    function updateFeeReceiver(address newFeeReceiver) external onlyOwner {
        feeReceiver = newFeeReceiver;
        emit FeeReceiverUpdated(newFeeReceiver);
    }

    function updateBalanceThreshold(uint256 newBalanceThreshold) external onlyOwner {
        balanceThreshold = newBalanceThreshold;
        emit BalanceThresholdUpdated(balanceThreshold);
    }

    function userAboveBalanceThreshold(address _account) public view returns (bool) {
        return saveYourAssetsToken.balanceOf(_account) >= balanceThreshold;
    }

    /**
     * @dev Withdraw BNB that somehow ended up in the contract.
     */
    function withdrawBnb() external onlyOwner {
        TransferHelper.safeTransferETH(msg.sender, address(this).balance);
    }

    /**
     * @dev Withdraw any erc20 compliant tokens that
     * somehow ended up in the contract.
     */
    function withdrawErc20Token(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
