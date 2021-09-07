mkdir ./contracts/.flattened
npx hardhat flatten ./contracts/FloozRouter.sol > ./contracts/.flattened/FloozRouter.sol
npx hardhat flatten ./contracts/TestRouter.sol > ./contracts/.flattened/TestRouter.sol
npx hardhat flatten ./contracts/FeeReceiver.sol > ./contracts/.flattened/FeeReceiver.sol