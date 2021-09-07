pragma solidity =0.6.6;

// SPDX-License-Identifier: UNLICENSED
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@0x/contracts-utils/contracts/src/v06/LibBytesV06.sol";
import "./interfaces/IZerox.sol";

contract TestRouter is Ownable, Pausable {
    using LibBytesV06 for bytes;
    using SafeMath for uint256;

    address payable public immutable zerox;
    address payable public immutable feeReceiver;

    event ReturnValues(uint256 buyAmount);
    event FeePaid(address token, uint256 amount);

    constructor() public {
        zerox = payable(0xDef1C0ded9bec7F1a1670819833240f027b25EfF);
        feeReceiver = payable(0x629C551f3D0140F256E6B6eE4cFd81A25F5e4c59);
    }

    function executeTrade(bytes memory _data) public payable {
        bytes4 selector = _data.readBytes4(0);
        address impl = IZerox(zerox).getFunctionImplementation(selector);
        (bool success, bytes memory resultData) = impl.delegatecall(_data);
        if (!success) {
            _revertWithData(resultData);
        }
        _returnWithData(resultData);
    }

    /// @dev Forwards calls to the appropriate implementation contract.
    fallback() external payable {
        bytes4 selector = msg.data.readBytes4(0);
        address impl = IZerox(zerox).getFunctionImplementation(selector);
        if (impl == address(0)) {
            _revertWithData(NotImplementedError(selector));
        }

        (bool success, bytes memory resultData) = impl.delegatecall(msg.data);
        if (!success) {
            _revertWithData(resultData);
        }
        _returnWithData(resultData);
    }

    function NotImplementedError(bytes4 selector) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(bytes4(keccak256("NotImplementedError(bytes4)")), selector);
    }

    function executeTrade2(bytes memory _data) public payable {
        zerox.delegatecall(_data);
    }

    function executeTo(address payable _to, bytes memory _data) public payable {
        _to.delegatecall(_data);
    }

    function executeToWithFee(
        address payable _to,
        bytes memory _data,
        address _token,
        uint256 _feeAmount
    ) public payable {
        uint256 balanceBefore;
        uint256 balanceAfter;

        if (_token == address(0)) {
            balanceBefore = msg.sender.balance;
            (bool success, ) = _to.delegatecall(_data);
            require(success, "TRADE_FAILED");
            balanceAfter = msg.sender.balance;
            require(_feeAmount <= balanceBefore.sub(balanceAfter).mul(50).div(10000), "INVALID_FEE");
            feeReceiver.transfer(_feeAmount);
        } else {
            balanceBefore = IERC20(_token).balanceOf(msg.sender);
            (bool success, ) = _to.delegatecall(_data);
            require(success, "TRADE_FAILED");
            balanceAfter = IERC20(_token).balanceOf(msg.sender);
            require(_feeAmount <= balanceBefore.sub(balanceAfter).mul(50).div(10000), "INVALID_FEE");
            IERC20(_token).transferFrom(msg.sender, feeReceiver, _feeAmount);
        }
        emit FeePaid(_token, _feeAmount);
    }

    function approveToken(address _token, bytes memory _data) public {
        _token.delegatecall(_data);
    }

    /// @dev Revert with arbitrary bytes.
    /// @param data Revert data.
    function _revertWithData(bytes memory data) private pure {
        assembly {
            revert(add(data, 32), mload(data))
        }
    }

    /// @dev Return with arbitrary bytes.
    /// @param data Return data.
    function _returnWithData(bytes memory data) private pure {
        assembly {
            return(add(data, 32), mload(data))
        }
    }

    /// @dev Fallback for just receiving ether.
    receive() external payable {}

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
