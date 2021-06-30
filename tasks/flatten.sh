mkdir ./contracts/.flattened
npx hardhat flatten ./contracts/SaveYourPancakeRouter.sol > ./contracts/.flattened/SaveYourPancakeRouter.sol
npx hardhat flatten ./contracts/FeeReceiver.sol > ./contracts/.flattened/FeeReceiver.sol