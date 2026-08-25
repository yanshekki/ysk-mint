// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {LaunchErrors} from "../../errors/LaunchErrors.sol";

library Limits {
    struct Data {
        uint256 maxTx;
        uint256 maxWallet;
    }

    function enforceTx(Data storage d, uint256 amount) internal view {
        if (d.maxTx != 0 && amount > d.maxTx) revert LaunchErrors.MaxTxExceeded(amount, d.maxTx);
    }

    function enforceWallet(Data storage d, uint256 newBalance) internal view {
        if (d.maxWallet != 0 && newBalance > d.maxWallet) {
            revert LaunchErrors.MaxWalletExceeded(newBalance, d.maxWallet);
        }
    }
}
