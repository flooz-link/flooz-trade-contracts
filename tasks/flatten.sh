mkdir ./contracts/.flattened
npx hardhat flatten ./contracts/FloozRouter.sol > ./contracts/.flattened/FloozRouter.sol
npx hardhat flatten ./contracts/FeeReceiver.sol > ./contracts/.flattened/FeeReceiver.sol