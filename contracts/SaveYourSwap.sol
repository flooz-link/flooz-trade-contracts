pragma solidity >=0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./interfaces/ISaveYourSwapERC20.sol";
import "./libraries/PancakeLibrary.sol";
import "./interfaces/IPancakeRouter02.sol";
import "hardhat/console.sol";

contract SaveYourSwap is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for ISaveYourSwapERC20;

    uint8 private constant FEE_DENOMINATOR = 100;

    IPancakeRouter02 public router;
    address public immutable WBNB;
    address public immutable feeReceiver;

    uint256 public freeTradeThreshold;
    uint8 public swapFee;

    ISaveYourSwapERC20 public saveYourAssetsToken;

    constructor(address _router, address _saveYourAssetsToken, uint8 _swapFee, uint256 _freeTradeThreshold) {
        router = IPancakeRouter02(_router);
        saveYourAssetsToken = ISaveYourSwapERC20(_saveYourAssetsToken);
        swapFee = _swapFee;
        freeTradeThreshold = _freeTradeThreshold;
        feeReceiver = address(this);
        WBNB = router.WETH();
    }

    receive() external payable {}

    function swapBNBForSaveYourAssetsToken() external payable {
        uint256 quoteAmountBase = msg.value;
        
        (uint256 reserveInput, uint256 reserveOutput) = PancakeLibrary.getReserves(router.factory(), WBNB, address(saveYourAssetsToken));
        (uint256 quoteAmount, uint256 feeAmount) = _calculateFee(quoteAmountBase);
        console.log("quoteAmount: ", quoteAmount);
        console.log("feeAmount: ", feeAmount);
        uint256 currentBestOutput = PancakeLibrary.quote(quoteAmount, reserveInput, reserveOutput);
        uint256 currentBestInput = PancakeLibrary.quote(currentBestOutput, reserveOutput, reserveInput);
        console.log("currentBestOuput: ", currentBestOutput);
        console.log("currentBestInput: ", currentBestInput);
        uint256 currentBestOuputWithoutFees = currentBestOutput.sub(currentBestOutput.mul(102).div(1000));
        address[] memory path = new address[](2);
        path[0] = WBNB;
        path[1] = address(saveYourAssetsToken);
        router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: quoteAmount}(currentBestOuputWithoutFees, path, _msgSender(), block.timestamp);
    }

    function _calculateFee(uint256 _amount) private returns(uint256 quoteAmount, uint256 feeAmount) {
        feeAmount = _amount.mul(swapFee).div(FEE_DENOMINATOR);
        quoteAmount = _amount.sub(feeAmount);
    }

}