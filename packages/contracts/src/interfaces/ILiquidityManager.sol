// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface ILiquidityManager {
    event LiquidityLaunched(
        address indexed token, address indexed lpToken, address indexed user, uint256 liquidity, uint256 lockId
    );

    function locker() external view returns (address);
    function addAndLock(
        address token,
        address router,
        uint256 tokenAmount,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        uint8 lockMode,
        uint64 lockDuration
    ) external payable returns (uint256 lockId, uint256 liquidity, address lpToken);
}
