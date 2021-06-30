pragma solidity =0.6.6;

// SPDX-License-Identifier: UNLICENSED
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./libraries/TransferHelper.sol";
import "./interfaces/IPancakeRouter02.sol";
import "./interfaces/IWETH.sol";

contract FeeReceiver is Pausable, Ownable {
    using SafeMath for uint256;

    event BuybackRateUpdated(uint256 newBuybackRate);
    event RevenueReceiverUpdated(address newRevenueReceiver);
    event RouterWhitelistUpdated(address router, bool status);
    event BuybackExecuted(uint256 amountBuyback, uint256 amountRevenue);

    uint256 public constant FEE_DENOMINATOR = 10000;
    address internal constant ZERO_ADDRESS = address(0x000000000000000000000000000000000000dEaD);
    IPancakeRouter02 public pancakeRouter;
    address payable public revenueReceiver;
    address public SYA;
    address public WBNB;
    uint256 buybackRate;
    mapping(address => bool) public routerWhitelist;

    constructor(
        IPancakeRouter02 _pancakeRouterV2,
        address _SYA,
        address _WBNB,
        address payable _revenueReceiver,
        uint256 _buybackRate
    ) public {
        pancakeRouter = _pancakeRouterV2;
        SYA = _SYA;
        WBNB = _WBNB;
        revenueReceiver = _revenueReceiver;
        buybackRate = _buybackRate;
        routerWhitelist[address(pancakeRouter)] = true;
    }

    /**
     * @dev executes the buyback, buys SYA & sends revenue to the revenueReceiver by the defined rate
     */
    function executeBuyback() external whenNotPaused() {
        require(address(this).balance > 0, "FeeReceiver: No balance for buyback");
        address[] memory path = new address[](2);
        path[0] = WBNB;
        path[1] = SYA;

        uint256 balance = address(this).balance;
        uint256 amountBuyback = balance.mul(buybackRate).div(FEE_DENOMINATOR);
        uint256 amountRevenue = balance.sub(amountBuyback);

        pancakeRouter.swapExactETHForTokensSupportingFeeOnTransferTokens{value: amountBuyback}(0, path, ZERO_ADDRESS, block.timestamp);
        TransferHelper.safeTransferETH(revenueReceiver, amountRevenue);
        emit BuybackExecuted(amountBuyback, amountRevenue);
    }

    /**
     * @dev converts collected tokens from fees to BNB to execute buybacks
     */
    function convertToBnb(
        address _router,
        IERC20 _token,
        bool _fee
    ) public whenNotPaused() {
        require(routerWhitelist[_router], "FeeReceiver: Router not whitelisted");
        address[] memory path = new address[](2);
        path[0] = address(_token);
        path[1] = WBNB;

        uint256 balance = _token.balanceOf(address(this));
        TransferHelper.safeApprove(address(_token), address(pancakeRouter), balance);
        if (_fee) {
            IPancakeRouter02(_router).swapExactTokensForETHSupportingFeeOnTransferTokens(balance, 0, path, address(this), block.timestamp);
        } else {
            IPancakeRouter02(_router).swapExactTokensForETH(balance, 0, path, address(this), block.timestamp);
        }
    }

    /**
     * @dev converts WBNB to BNB
     */
    function unwrapWBNB() public whenNotPaused() {
        uint256 balance = IWETH(WBNB).balanceOf(address(this));
        require(balance > 0, "FeeReceiver: Nothing to unwrap");
        IWETH(WBNB).withdraw(balance);
    }

    /**
     * @dev lets the owner update update the router whitelist
     */
    function updateRouterWhiteliste(address _router, bool _status) external onlyOwner {
        routerWhitelist[_router] = _status;
        emit RouterWhitelistUpdated(_router, _status);
    }

    /**
     * @dev lets the owner update the buyback rate
     */
    function updateBuybackRate(uint256 _newBuybackRate) external onlyOwner {
        buybackRate = _newBuybackRate;
        emit BuybackRateUpdated(_newBuybackRate);
    }

    /**
     * @dev lets the owner update the buyback rate
     */
    function updateRevenueReceiver(address payable _newRevenueReceiver) external onlyOwner {
        revenueReceiver = _newRevenueReceiver;
        emit RevenueReceiverUpdated(_newRevenueReceiver);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
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

    receive() external payable {}
}
