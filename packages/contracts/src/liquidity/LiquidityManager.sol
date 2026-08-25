// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {LaunchErrors} from "../errors/LaunchErrors.sol";
import {LaunchValidation} from "../libraries/LaunchValidation.sol";
import {UniswapV2Adapter} from "../dex/UniswapV2Adapter.sol";
import {ILiquidityLocker} from "../interfaces/ILiquidityLocker.sol";
import {ILiquidityManager} from "../interfaces/ILiquidityManager.sol";

contract LiquidityManager is ILiquidityManager {
    using SafeERC20 for IERC20;

    address public immutable override locker;

    constructor(address locker_) {
        LaunchValidation.validateNonZeroAddress(locker_);
        locker = locker_;
    }

    function addAndLock(
        address token,
        address router,
        uint256 tokenAmount,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        uint8 lockMode,
        uint64 lockDuration
    ) external payable override returns (uint256 lockId, uint256 liquidity, address lpToken) {
        LaunchValidation.validateNonZeroAddress(token);
        if (tokenAmount == 0 || msg.value == 0) revert LaunchErrors.ZeroAmount();
        LaunchValidation.validateLock(lockMode, lockDuration);

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);
        IERC20(token).forceApprove(router, tokenAmount);

        (liquidity, lpToken) = UniswapV2Adapter.addLiquidityETH(
            router, token, tokenAmount, amountTokenMin, amountETHMin, address(this)
        );

        IERC20(lpToken).forceApprove(locker, liquidity);
        lockId = ILiquidityLocker(locker).lock(lpToken, liquidity, lockMode, lockDuration, msg.sender);
        emit LiquidityLaunched(token, lpToken, msg.sender, liquidity, lockId);

        uint256 leftover = IERC20(token).balanceOf(address(this));
        if (leftover > 0) IERC20(token).safeTransfer(msg.sender, leftover);
        if (address(this).balance > 0) {
            (bool ok,) = msg.sender.call{value: address(this).balance}("");
            if (!ok) revert LaunchErrors.NativeTransferFailed();
        }
    }

    receive() external payable {}
}
