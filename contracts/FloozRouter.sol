pragma solidity =0.6.6;

// SPDX-License-Identifier: UNLICENSED
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./libraries/TransferHelper.sol";
import "./libraries/PancakeLibrary.sol";
import "./interfaces/IReferralRegistry.sol";
import "./interfaces/IReferrals.sol";
import "./interfaces/IWETH.sol";

contract FloozRouter is Ownable, Pausable {
    using SafeMath for uint256;
    event SwapFeeUpdated(uint16 swapFee);
    event ReferralRewardRateUpdated(uint16 referralRewardRate);
    event ReferralsActivatedUpdated(bool activated);
    event FeeReceiverUpdated(address feeReceiver);
    event BalanceThresholdUpdated(uint256 balanceThreshold);
    event ReferralRegistryUpdated(address referralRegistry);
    event CustomReferralRewardRateUpdated(address indexed account, uint16 referralRate);
    event ReferralRewardPaid(address from, address indexed to, address tokenOut, address tokenReward, uint256 amount);

    uint256 public constant FEE_DENOMINATOR = 10000;
    address public immutable WETH;
    IReferralRegistry public referralRegistry;
    bytes internal pancakeInitCodeV1;
    bytes internal pancakeInitCodeV2;
    address public pancakeFactoryV1;
    address public pancakeFactoryV2;
    IERC20 public saveYourAssetsToken;
    uint256 public balanceThreshold;
    address public feeReceiver;
    uint16 public swapFee;
    uint16 public referralRewardRate;
    bool public referralsActivated;

    // stores individual referral rates
    mapping(address => uint16) public customReferralRewardRate;

    // stores the address that refered this user
    mapping(address => address) public referralAnchor;

    modifier isValidFactory(address factory) {
        require(factory == pancakeFactoryV1 || factory == pancakeFactoryV2, "FloozRouter: invalid factory");
        _;
    }

    modifier isValidReferee(address referee) {
        require(msg.sender != referee, "FloozRouter: self referral");
        _;
    }

    constructor(
        address _WETH,
        uint16 _swapFee,
        uint16 _referralRewardRate,
        address _feeReceiver,
        uint256 _balanceThreshold,
        IERC20 _saveYourAssetsToken,
        address _pancakeFactoryV1,
        address _pancakeFactoryV2,
        bytes memory _pancakeInitCodeV1,
        bytes memory _pancakeInitCodeV2,
        IReferralRegistry _referralRegistry
    ) public {
        WETH = _WETH;
        swapFee = _swapFee;
        referralRewardRate = _referralRewardRate;
        feeReceiver = _feeReceiver;
        saveYourAssetsToken = _saveYourAssetsToken;
        balanceThreshold = _balanceThreshold;
        pancakeFactoryV1 = _pancakeFactoryV1;
        pancakeFactoryV2 = _pancakeFactoryV2;
        pancakeInitCodeV1 = _pancakeInitCodeV1;
        pancakeInitCodeV2 = _pancakeInitCodeV2;
        referralsActivated = true;
        referralRegistry = _referralRegistry;
    }

    receive() external payable {}

    // **** SWAP ****
    // requires the initial amount to have already been sent to the first pair
    function _swap(
        address factory,
        uint256[] memory amounts,
        address[] memory path,
        address _to
    ) internal {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0, ) = PancakeLibrary.sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = input == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
            address to = i < path.length - 2 ? _pairFor(factory, output, path[i + 2]) : _to;
            IPancakePair(_pairFor(factory, input, output)).swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }

    function swapExactETHForTokens(
        address factory,
        uint256 amountOutMin,
        address[] calldata path,
        address referee
    ) external payable whenNotPaused isValidFactory(factory) isValidReferee(referee) returns (uint256[] memory amounts) {
        require(path[0] == WETH, "FloozRouter: INVALID_PATH");
        referee = _getReferee(referee);
        (uint256 swapAmount, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(msg.value, referee);
        amounts = _getAmountsOut(factory, swapAmount, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "FloozRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        IWETH(WETH).deposit{value: swapAmount}();
        assert(IWETH(WETH).transfer(_pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(factory, amounts, path, msg.sender);

        if (feeAmount > 0) {
            _withdrawFeesAndRewards(address(0), path[path.length - 1], referee, feeAmount, referralReward);
        }
    }

    // **** SWAP (supporting fee-on-transfer tokens) ****
    // requires the initial amount to have already been sent to the first pair
    function _swapSupportingFeeOnTransferTokens(
        address factory,
        address[] memory path,
        address _to
    ) internal {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0, ) = PancakeLibrary.sortTokens(input, output);
            IPancakePair pair = IPancakePair(_pairFor(factory, input, output));
            uint256 amountInput;
            uint256 amountOutput;
            {
                // scope to avoid stack too deep errors
                (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
                (uint256 reserveInput, uint256 reserveOutput) = input == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
                amountInput = IERC20(input).balanceOf(address(pair)).sub(reserveInput);
                amountOutput = _getAmountOut(amountInput, reserveInput, reserveOutput);
            }
            (uint256 amount0Out, uint256 amount1Out) = input == token0 ? (uint256(0), amountOutput) : (amountOutput, uint256(0));
            address to = i < path.length - 2 ? _pairFor(factory, output, path[i + 2]) : _to;
            pair.swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        address factory,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address referee
    ) external whenNotPaused isValidFactory(factory) isValidReferee(referee) {
        require(path[path.length - 1] == WETH, "FloozRouter: BNB has to be the last path item");
        referee = _getReferee(referee);
        TransferHelper.safeTransferFrom(path[0], msg.sender, _pairFor(factory, path[0], path[1]), amountIn);
        _swapSupportingFeeOnTransferTokens(factory, path, address(this));
        uint256 amountOut = IERC20(WETH).balanceOf(address(this));
        require(amountOut >= amountOutMin, "FloozRouter: slippage setting to low");
        IWETH(WETH).withdraw(amountOut);
        (uint256 amountWithdraw, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(amountOut, referee);
        TransferHelper.safeTransferETH(msg.sender, amountWithdraw);

        if (feeAmount > 0) _withdrawFeesAndRewards(address(0), path[path.length - 1], referee, feeAmount, referralReward);
    }

    function swapExactTokensForTokens(
        address factory,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address referee
    ) external whenNotPaused isValidFactory(factory) isValidReferee(referee) returns (uint256[] memory amounts) {
        referee = _getReferee(referee);
        (uint256 swapAmount, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(amountIn, referee);
        amounts = _getAmountsOut(factory, swapAmount, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "FloozRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        TransferHelper.safeTransferFrom(path[0], msg.sender, _pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(factory, amounts, path, msg.sender);

        if (feeAmount > 0) _withdrawFeesAndRewards(path[0], path[path.length - 1], referee, feeAmount, referralReward);
    }

    function swapExactTokensForETH(
        address factory,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address referee
    ) external whenNotPaused isValidFactory(factory) isValidReferee(referee) returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WETH, "FloozRouter: INVALID_PATH");
        referee = _getReferee(referee);
        amounts = _getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "FloozRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        TransferHelper.safeTransferFrom(path[0], msg.sender, _pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(factory, amounts, path, address(this));
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        (uint256 amountOut, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(amounts[amounts.length - 1], referee);
        TransferHelper.safeTransferETH(msg.sender, amountOut);

        if (feeAmount > 0) _withdrawFeesAndRewards(address(0), path[path.length - 1], referee, feeAmount, referralReward);
    }

    function swapETHForExactTokens(
        address factory,
        uint256 amountOut,
        address[] calldata path,
        address referee
    ) external payable whenNotPaused isValidFactory(factory) isValidReferee(referee) returns (uint256[] memory amounts) {
        require(path[0] == WETH, "FloozRouter: INVALID_PATH");
        referee = _getReferee(referee);
        amounts = _getAmountsIn(factory, amountOut, path);
        (, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(amounts[0], referee);
        require(amounts[0].add(feeAmount).add(referralReward) <= msg.value, "FloozRouter: EXCESSIVE_INPUT_AMOUNT");
        IWETH(WETH).deposit{value: amounts[0]}();
        assert(IWETH(WETH).transfer(_pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(factory, amounts, path, msg.sender);

        if (feeAmount > 0) _withdrawFeesAndRewards(address(0), path[path.length - 1], referee, feeAmount, referralReward);

        // refund dust eth, if any
        if (msg.value > amounts[0].add(feeAmount).add(referralReward))
            TransferHelper.safeTransferETH(msg.sender, msg.value - amounts[0].add(feeAmount).add(referralReward));
    }

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        address factory,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address referee
    ) external whenNotPaused isValidFactory(factory) isValidReferee(referee) {
        referee = _getReferee(referee);
        (uint256 swapAmount, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(amountIn, referee);
        TransferHelper.safeTransferFrom(path[0], msg.sender, _pairFor(factory, path[0], path[1]), swapAmount);
        uint256 balanceBefore = IERC20(path[path.length - 1]).balanceOf(msg.sender);
        _swapSupportingFeeOnTransferTokens(factory, path, msg.sender);
        require(
            IERC20(path[path.length - 1]).balanceOf(msg.sender).sub(balanceBefore) >= amountOutMin,
            "FloozRouter: INSUFFICIENT_OUTPUT_AMOUNT"
        );

        if (feeAmount > 0) _withdrawFeesAndRewards(path[0], path[path.length - 1], referee, feeAmount, referralReward);
    }

    function swapTokensForExactTokens(
        address factory,
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address referee
    ) external whenNotPaused isValidFactory(factory) isValidReferee(referee) returns (uint256[] memory amounts) {
        referee = _getReferee(referee);
        amounts = _getAmountsIn(factory, amountOut, path);
        (, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(amounts[0], referee);
        require(amounts[0].add(feeAmount).add(referralReward) <= amountInMax, "FloozRouter: EXCESSIVE_INPUT_AMOUNT");
        TransferHelper.safeTransferFrom(path[0], msg.sender, _pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(factory, amounts, path, msg.sender);

        if (feeAmount > 0) _withdrawFeesAndRewards(path[0], path[path.length - 1], referee, feeAmount, referralReward);
    }

    function swapTokensForExactETH(
        address factory,
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address referee
    ) external whenNotPaused isValidFactory(factory) isValidReferee(referee) returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WETH, "FloozRouter: INVALID_PATH");
        referee = _getReferee(referee);
        amounts = _getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, "FloozRouter: EXCESSIVE_INPUT_AMOUNT");
        TransferHelper.safeTransferFrom(path[0], msg.sender, _pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(factory, amounts, path, address(this));
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        (uint256 swapAmount, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(amounts[amounts.length - 1], referee);

        TransferHelper.safeTransferETH(msg.sender, swapAmount);
        if (feeAmount > 0) _withdrawFeesAndRewards(address(0), path[path.length - 1], referee, feeAmount, referralReward);
    }

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        address factory,
        uint256 amountOutMin,
        address[] calldata path,
        address referee
    ) external payable whenNotPaused isValidFactory(factory) isValidReferee(referee) {
        require(path[0] == WETH, "FloozRouter: INVALID_PATH");
        referee = _getReferee(referee);
        (uint256 swapAmount, uint256 feeAmount, uint256 referralReward) = _calculateFeesAndRewards(msg.value, referee);
        IWETH(WETH).deposit{value: swapAmount}();
        assert(IWETH(WETH).transfer(_pairFor(factory, path[0], path[1]), swapAmount));
        uint256 balanceBefore = IERC20(path[path.length - 1]).balanceOf(msg.sender);
        _swapSupportingFeeOnTransferTokens(factory, path, msg.sender);
        require(
            IERC20(path[path.length - 1]).balanceOf(msg.sender).sub(balanceBefore) >= amountOutMin,
            "FloozRouter: INSUFFICIENT_OUTPUT_AMOUNT"
        );
        if (feeAmount > 0) _withdrawFeesAndRewards(address(0), path[path.length - 1], referee, feeAmount, referralReward);
    }

    function _getReferee(address referee) internal returns (address) {
        address sender = msg.sender;
        if (!referralRegistry.hasUserReferee(sender)) {
            referralRegistry.createReferralAnchor(sender, referee);
        }
        return referralRegistry.getUserReferee(sender);
    }

    function _calculateFeesAndRewards(uint256 amount, address referee)
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
            if (referee != address(0) && referralsActivated) {
                uint16 referralRate = customReferralRewardRate[referee] > 0 ? customReferralRewardRate[referee] : referralRewardRate;
                referralReward = fees.mul(referralRate).div(FEE_DENOMINATOR);
                feeAmount = amount.sub(swapAmount).sub(referralReward);
            } else {
                referralReward = 0;
                feeAmount = fees;
            }
        }
    }

    function userAboveBalanceThreshold(address _account) public view returns (bool) {
        return saveYourAssetsToken.balanceOf(_account) >= balanceThreshold;
    }

    function getUserFee(address user) public view returns (uint256) {
        saveYourAssetsToken.balanceOf(user) >= balanceThreshold ? 0 : swapFee;
    }

    function updateSwapFee(uint16 newSwapFee) external onlyOwner {
        swapFee = newSwapFee;
        emit SwapFeeUpdated(newSwapFee);
    }

    function updateReferralRewardRate(uint16 newReferralRewardRate) external onlyOwner {
        referralRewardRate = newReferralRewardRate;
        emit ReferralRewardRateUpdated(newReferralRewardRate);
    }

    function updateFeeReceiver(address newFeeReceiver) external onlyOwner {
        feeReceiver = newFeeReceiver;
        emit FeeReceiverUpdated(newFeeReceiver);
    }

    function updateBalanceThreshold(uint256 newBalanceThreshold) external onlyOwner {
        balanceThreshold = newBalanceThreshold;
        emit BalanceThresholdUpdated(balanceThreshold);
    }

    function updateReferralsActivated(bool newReferralsActivated) external onlyOwner {
        referralsActivated = newReferralsActivated;
        emit ReferralsActivatedUpdated(newReferralsActivated);
    }

    function updateReferralRegistry(address newReferralRegistry) external onlyOwner {
        referralRegistry = IReferralRegistry(newReferralRegistry);
        emit ReferralRegistryUpdated(newReferralRegistry);
    }

    function updateCustomReferralRewardRate(address account, uint16 referralRate) external onlyOwner returns (uint256) {
        require(referralRate <= FEE_DENOMINATOR, "FloozRouter: INVALID_RATE");
        customReferralRewardRate[account] = referralRate;
        emit CustomReferralRewardRateUpdated(account, referralRate);
    }

    function getUserReferee(address user) external view returns (address) {
        return referralRegistry.getUserReferee(user);
    }

    function hasUserReferee(address user) external view returns (bool) {
        return referralRegistry.hasUserReferee(user);
    }

    /**
     * @dev Withdraw BNB that somehow ended up in the contract.
     */
    function withdrawBnb(address payable to, uint256 amount) external onlyOwner {
        to.transfer(amount);
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

    function _withdrawFeesAndRewards(
        address tokenReward,
        address tokenOut,
        address referee,
        uint256 feeAmount,
        uint256 referralReward
    ) internal {
        if (tokenReward == address(0)) {
            TransferHelper.safeTransferETH(feeReceiver, feeAmount);
            if (referralReward > 0) {
                TransferHelper.safeTransferETH(referee, referralReward);
                emit ReferralRewardPaid(msg.sender, referee, tokenOut, tokenReward, referralReward);
            }
        } else {
            TransferHelper.safeTransferFrom(tokenReward, msg.sender, feeReceiver, feeAmount);
            if (referralReward > 0) {
                TransferHelper.safeTransferFrom(tokenReward, msg.sender, referee, referralReward);
                emit ReferralRewardPaid(msg.sender, referee, tokenOut, tokenReward, referralReward);
            }
        }
    }

    // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function _getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal view returns (uint256 amountOut) {
        require(amountIn > 0, "FloozRouter: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "FloozRouter: INSUFFICIENT_LIQUIDITY");
        uint256 amountInWithFee = amountIn.mul((9975 - getUserFee(msg.sender)));
        uint256 numerator = amountInWithFee.mul(reserveOut);
        uint256 denominator = reserveIn.mul(10000).add(amountInWithFee);
        amountOut = numerator / denominator;
    }

    // given an output amount of an asset and pair reserves, returns a required input amount of the other asset
    function _getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal view returns (uint256 amountIn) {
        require(amountOut > 0, "FloozRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "FloozRouter: INSUFFICIENT_LIQUIDITY");
        uint256 numerator = reserveIn.mul(amountOut).mul(10000);
        uint256 denominator = reserveOut.sub(amountOut).mul(9975 - getUserFee(msg.sender));
        amountIn = (numerator / denominator).add(1);
    }

    // performs chained getAmountOut calculations on any number of pairs
    function _getAmountsOut(
        address factory,
        uint256 amountIn,
        address[] memory path
    ) internal view returns (uint256[] memory amounts) {
        require(path.length >= 2, "FloozRouter: INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i; i < path.length - 1; i++) {
            (uint256 reserveIn, uint256 reserveOut) = _getReserves(factory, path[i], path[i + 1]);
            amounts[i + 1] = _getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    // performs chained getAmountIn calculations on any number of pairs
    function _getAmountsIn(
        address factory,
        uint256 amountOut,
        address[] memory path
    ) internal view returns (uint256[] memory amounts) {
        require(path.length >= 2, "FloozRouter: INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[amounts.length - 1] = amountOut;
        for (uint256 i = path.length - 1; i > 0; i--) {
            (uint256 reserveIn, uint256 reserveOut) = _getReserves(factory, path[i - 1], path[i]);
            amounts[i - 1] = _getAmountIn(amounts[i], reserveIn, reserveOut);
        }
    }

    // fetches and sorts the reserves for a pair
    function _getReserves(
        address factory,
        address tokenA,
        address tokenB
    ) internal view returns (uint256 reserveA, uint256 reserveB) {
        (address token0, ) = PancakeLibrary.sortTokens(tokenA, tokenB);
        (uint256 reserve0, uint256 reserve1, ) = IPancakePair(_pairFor(factory, tokenA, tokenB)).getReserves();
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }

    // calculates the CREATE2 address for a pair without making any external calls
    function _pairFor(
        address factory,
        address tokenA,
        address tokenB
    ) internal view returns (address pair) {
        (address token0, address token1) = PancakeLibrary.sortTokens(tokenA, tokenB);
        bytes memory initcode = factory == pancakeFactoryV1 ? pancakeInitCodeV1 : pancakeInitCodeV2;
        pair = address(
            uint256(
                keccak256(
                    abi.encodePacked(
                        hex"ff",
                        factory,
                        keccak256(abi.encodePacked(token0, token1)),
                        initcode // init code hash
                    )
                )
            )
        );
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
