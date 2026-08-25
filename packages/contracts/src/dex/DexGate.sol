// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {LaunchEnums} from "../enums/LaunchEnums.sol";
import {LaunchErrors} from "../errors/LaunchErrors.sol";
import {LaunchValidation} from "../libraries/LaunchValidation.sol";

library DexGate {
    function requireV2Compatible(uint8 dexKind) internal pure {
        LaunchValidation.validateDexKind(dexKind);
        if (dexKind == uint8(LaunchEnums.DexKind.UniswapV3)) revert LaunchErrors.DexUnsupported(dexKind);
    }
}
