// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {LaunchEnums} from "../enums/LaunchEnums.sol";
import {LaunchErrors} from "../errors/LaunchErrors.sol";
import {LaunchValidation} from "../libraries/LaunchValidation.sol";
import {ILiquidityLocker} from "../interfaces/ILiquidityLocker.sol";

contract LiquidityLocker is ILiquidityLocker {
    using SafeERC20 for IERC20;

    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    uint256 public override nextId = 1;
    mapping(uint256 => Lock) private _locks;

    function getLock(uint256 lockId) external view override returns (Lock memory) {
        if (lockId == 0 || lockId >= nextId) revert LaunchErrors.LockNotFound();
        return _locks[lockId];
    }

    function lock(address token, uint256 amount, uint8 mode, uint64 duration, address beneficiary)
        external
        override
        returns (uint256 lockId)
    {
        LaunchValidation.validateNonZeroAddress(token);
        LaunchValidation.validateNonZeroAddress(beneficiary);
        if (amount == 0) revert LaunchErrors.ZeroAmount();
        LaunchValidation.validateLock(mode, duration);

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        uint64 unlockAt;
        if (LaunchEnums.LockMode(mode) == LaunchEnums.LockMode.Burn) {
            IERC20(token).safeTransfer(DEAD, amount);
            unlockAt = type(uint64).max;
        } else {
            unlockAt = uint64(block.timestamp) + duration;
        }

        lockId = nextId++;
        _locks[lockId] = Lock({
            token: token,
            owner: beneficiary,
            amount: amount,
            unlockAt: unlockAt,
            mode: mode,
            withdrawn: LaunchEnums.LockMode(mode) == LaunchEnums.LockMode.Burn
        });
        emit Locked(lockId, token, beneficiary, amount, mode, unlockAt);
    }

    function withdraw(uint256 lockId) external override {
        Lock storage item = _requireLock(lockId);
        if (msg.sender != item.owner) revert LaunchErrors.NotLockOwner();
        if (item.withdrawn) revert LaunchErrors.AlreadyWithdrawn();
        if (LaunchEnums.LockMode(item.mode) == LaunchEnums.LockMode.Burn) {
            revert LaunchErrors.AlreadyWithdrawn();
        }
        if (block.timestamp < item.unlockAt) revert LaunchErrors.LockNotMature(item.unlockAt);
        item.withdrawn = true;
        IERC20(item.token).safeTransfer(item.owner, item.amount);
        emit Withdrawn(lockId, item.owner, item.amount);
    }

    function extend(uint256 lockId, uint64 extraSeconds) external override {
        Lock storage item = _requireLock(lockId);
        if (msg.sender != item.owner) revert LaunchErrors.NotLockOwner();
        if (item.withdrawn) revert LaunchErrors.AlreadyWithdrawn();
        if (LaunchEnums.LockMode(item.mode) != LaunchEnums.LockMode.Timed) {
            revert LaunchErrors.InvalidLockMode(item.mode);
        }
        uint64 newUnlock = item.unlockAt + extraSeconds;
        uint64 minFromNow = uint64(block.timestamp) + LaunchValidation.LOCK_MIN_SECONDS;
        if (newUnlock < minFromNow || newUnlock - uint64(block.timestamp) > LaunchValidation.LOCK_MAX_SECONDS) {
            revert LaunchErrors.LockDurationInvalid(extraSeconds);
        }
        if (newUnlock <= item.unlockAt) revert LaunchErrors.LockDurationInvalid(extraSeconds);
        item.unlockAt = newUnlock;
        emit LockExtended(lockId, newUnlock);
    }

    function transferLock(uint256 lockId, address newOwner) external override {
        Lock storage item = _requireLock(lockId);
        if (msg.sender != item.owner) revert LaunchErrors.NotLockOwner();
        if (item.withdrawn) revert LaunchErrors.AlreadyWithdrawn();
        LaunchValidation.validateNonZeroAddress(newOwner);
        address from = item.owner;
        item.owner = newOwner;
        emit LockTransferred(lockId, from, newOwner);
    }

    function _requireLock(uint256 lockId) private view returns (Lock storage item) {
        if (lockId == 0 || lockId >= nextId) revert LaunchErrors.LockNotFound();
        item = _locks[lockId];
    }
}
