// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface ILiquidityLocker {
    struct Lock {
        address token;
        address owner;
        uint256 amount;
        uint64 unlockAt;
        uint8 mode;
        bool withdrawn;
    }

    event Locked(
        uint256 indexed lockId,
        address indexed token,
        address indexed owner,
        uint256 amount,
        uint8 mode,
        uint64 unlockAt
    );
    event Withdrawn(uint256 indexed lockId, address indexed to, uint256 amount);
    event LockExtended(uint256 indexed lockId, uint64 unlockAt);
    event LockTransferred(uint256 indexed lockId, address indexed from, address indexed to);

    function nextId() external view returns (uint256);
    function getLock(uint256 lockId) external view returns (Lock memory);
    function lock(address token, uint256 amount, uint8 mode, uint64 duration, address beneficiary)
        external
        returns (uint256 lockId);
    function withdraw(uint256 lockId) external;
    function extend(uint256 lockId, uint64 extraSeconds) external;
    function transferLock(uint256 lockId, address newOwner) external;
}
