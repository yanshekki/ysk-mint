// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {LaunchErrors} from "../../errors/LaunchErrors.sol";

library AccessLists {
    struct Data {
        mapping(address => bool) blacklisted;
    }

    function requireNotBlacklisted(Data storage d, address a, address b) internal view {
        if (d.blacklisted[a] || d.blacklisted[b]) revert LaunchErrors.Blacklisted();
    }
}
