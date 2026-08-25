// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {IUniswapV2Factory, IUniswapV2Router02} from "../interfaces/IUniswapV2.sol";
import {LaunchErrors} from "../errors/LaunchErrors.sol";
import {LaunchValidation} from "../libraries/LaunchValidation.sol";

library UniswapV2Adapter {
    function addLiquidityETH(
        address router,
        address token,
        uint256 tokenAmount,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address lpRecipient
    ) internal returns (uint256 liquidity, address lpToken) {
        LaunchValidation.validateNonZeroAddress(router);
        LaunchValidation.validateNonZeroAddress(token);
        LaunchValidation.validateNonZeroAddress(lpRecipient);
        if (tokenAmount == 0 || msg.value == 0) revert LaunchErrors.ZeroAmount();

        IUniswapV2Router02 r = IUniswapV2Router02(router);
        (,, liquidity) = r.addLiquidityETH{value: msg.value}(
            token, tokenAmount, amountTokenMin, amountETHMin, lpRecipient, block.timestamp
        );
        if (liquidity == 0) revert LaunchErrors.ZeroAmount();
        lpToken = IUniswapV2Factory(r.factory()).getPair(token, r.WETH());
        LaunchValidation.validateNonZeroAddress(lpToken);
    }
}
