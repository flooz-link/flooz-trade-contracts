pragma solidity ^0.8.0;

interface IZerox {
    function getFunctionImplementation(bytes4 selector) external returns (address payable);
}
