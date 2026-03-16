// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockFDUSD — Test token for ACM testnet deployments
/// @notice Public mint, no supply cap. NOT for production use.
contract MockFDUSD is ERC20 {
    constructor() ERC20("ACM Mock FDUSD", "mFDUSD") {}

    /// @notice Mint tokens to any address (public — test only)
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
