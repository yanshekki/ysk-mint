// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {LaunchErrors} from "../errors/LaunchErrors.sol";

/// @notice Placeholder. UI must not offer a buy button that pretends this works.
contract BondingCurve {
    function buy() external payable {
        revert LaunchErrors.BondingDisabled();
    }

    function sell(uint256) external pure {
        revert LaunchErrors.BondingDisabled();
    }
}
