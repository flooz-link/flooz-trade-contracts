pragma solidity =0.6.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./libraries/TransferHelper.sol";
import "./libraries/PancakeLibrary.sol";
import "./interfaces/IWETH.sol";

contract SaveYourPancakeRouter is Ownable {
    using SafeMath for uint256;
    event SwapFeeUpdated(uint8 swapFee);
    event FeeReceiverUpdated(address feeReceiver);

    uint256 public constant FEE_DENOMINATOR = 10000;
    IERC20 public saveYourAssetsToken;
    address public immutable factory;
    address public immutable WETH;
    uint256 public balanceThreshold;
    address public feeReceiver;
    uint8 public swapFee;

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "SaveYourPancake: deadline for trade passed");
        _;
    }

    constructor(
        address _factory,
        address _WETH,
        uint8 _swapFee,
        address _feeReceiver,
        uint256 _balanceThreshold,
        IERC20 _saveYourAssetsToken
    ) public {
        factory = _factory;
        WETH = _WETH;
        swapFee = _swapFee;
        feeReceiver = _feeReceiver;
        saveYourAssetsToken = _saveYourAssetsToken;
        balanceThreshold = _balanceThreshold;
    }

    receive() external payable {
        assert(msg.sender == WETH); // only accept ETH via fallback from the WETH contract
    }

    // **** SWAP ****
    // requires the initial amount to have already been sent to the first pair
    function _swap(
        uint256[] memory amounts,
        address[] memory path,
        address _to
    ) internal {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0, ) = PancakeLibrary.sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = input == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
            address to = i < path.length - 2 ? PancakeLibrary.pairFor(factory, output, path[i + 2]) : _to;
            IPancakePair(PancakeLibrary.pairFor(factory, input, output)).swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256[] memory amounts) {
        require(path[0] == WETH, "SaveYourPancakeRouter: INVALID_PATH");
        (uint256 swapAmount, uint256 feeAmount) = _calculateFee(msg.value);
        amounts = PancakeLibrary.getAmountsOut(factory, swapAmount, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "SaveYourPancakeRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        IWETH(WETH).deposit{value: amounts[0]}();
        assert(IWETH(WETH).transfer(PancakeLibrary.pairFor(factory, path[0], path[1]), amounts[0]));
        assert(IWETH(WETH).transfer(feeReceiver, feeAmount));
        _swap(amounts, path, to);
        // refund dust eth, if any
        if (msg.value > amounts[0].add(feeAmount)) TransferHelper.safeTransferETH(msg.sender, msg.value - amounts[0].add(feeAmount));
    }

    // **** SWAP (supporting fee-on-transfer tokens) ****
    // requires the initial amount to have already been sent to the first pair
    function _swapSupportingFeeOnTransferTokens(address[] memory path, address _to) internal {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0, ) = PancakeLibrary.sortTokens(input, output);
            IPancakePair pair = IPancakePair(PancakeLibrary.pairFor(factory, input, output));
            uint256 amountInput;
            uint256 amountOutput;
            {
                // scope to avoid stack too deep errors
                (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
                (uint256 reserveInput, uint256 reserveOutput) = input == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
                amountInput = IERC20(input).balanceOf(address(pair)).sub(reserveInput);
                amountOutput = PancakeLibrary.getAmountOut(amountInput, reserveInput, reserveOutput);
            }
            (uint256 amount0Out, uint256 amount1Out) = input == token0 ? (uint256(0), amountOutput) : (amountOutput, uint256(0));
            address to = i < path.length - 2 ? PancakeLibrary.pairFor(factory, output, path[i + 2]) : _to;
            pair.swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) {
        require(path[path.length - 1] == WETH, "SaveYourPancake: BNB has to be the last path item");
        TransferHelper.safeTransferFrom(path[0], msg.sender, PancakeLibrary.pairFor(factory, path[0], path[1]), amountIn);
        _swapSupportingFeeOnTransferTokens(path, address(this));
        uint256 amountOut = IERC20(WETH).balanceOf(address(this));
        require(amountOut >= amountOutMin, "SaveYourPancake: slippage setting to low");
        IWETH(WETH).withdraw(amountOut);
        (uint256 withdrawAmount, uint256 feeAmount) = _calculateFee(amountOut);
        TransferHelper.safeTransferETH(to, withdrawAmount);
        TransferHelper.safeTransferETH(feeReceiver, feeAmount);
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        (uint256 swapAmount, uint256 feeAmount) = _calculateFee(amountIn);
        amounts = PancakeLibrary.getAmountsOut(factory, swapAmount, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "SaveYourPancake: INSUFFICIENT_OUTPUT_AMOUNT");
        TransferHelper.safeTransferFrom(path[0], msg.sender, PancakeLibrary.pairFor(factory, path[0], path[1]), amounts[0]);
        TransferHelper.safeTransferFrom(path[0], msg.sender, feeReceiver, feeAmount);
        _swap(amounts, path, to);
    }

    function _calculateFee(uint256 amount) internal view returns (uint256 swapAmount, uint256 feeAmount) {
        if (saveYourAssetsToken.balanceOf(msg.sender) > balanceThreshold) {
            feeAmount = 0;
            swapAmount = amount;
        } else {
            feeAmount = amount.sub(amount.mul(swapFee).div(FEE_DENOMINATOR));
            swapAmount = amount.sub(feeAmount);
        }
    }

    function updateSwapFee(uint8 newSwapFee) external onlyOwner {
        swapFee = newSwapFee;
        emit SwapFeeUpdated(newSwapFee);
    }

    function updateFeeReceiver(address newFeeReceiver) external onlyOwner {
        feeReceiver = newFeeReceiver;
        emit FeeReceiverUpdated(newFeeReceiver);
    }
}
