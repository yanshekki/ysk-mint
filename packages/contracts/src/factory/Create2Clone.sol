// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {LaunchErrors} from "../errors/LaunchErrors.sol";

library Create2Clone {
    function cloneDeterministic(address implementation, bytes32 salt) internal returns (address instance) {
        instance = Clones.cloneDeterministic(implementation, salt);
        if (instance == address(0)) revert LaunchErrors.CloneFailed();
    }

    function predict(address implementation, bytes32 salt, address deployer) internal pure returns (address) {
        return Clones.predictDeterministicAddress(implementation, salt, deployer);
    }
}
