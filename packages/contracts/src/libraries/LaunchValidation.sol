// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {LaunchEnums} from "../enums/LaunchEnums.sol";
import {LaunchErrors} from "../errors/LaunchErrors.sol";

/// @notice Pure validation. No storage. SDK must use the same numeric bounds.
library LaunchValidation {
    uint256 internal constant NAME_MIN_BYTES = 1;
    uint256 internal constant NAME_MAX_BYTES = 32;
    uint256 internal constant SYMBOL_MIN_BYTES = 1;
    uint256 internal constant SYMBOL_MAX_BYTES = 11;
    uint8 internal constant DECIMALS_MIN = 6;
    uint8 internal constant DECIMALS_MAX = 18;
    uint256 internal constant MAX_SUPPLY = type(uint128).max;
    uint16 internal constant TAX_MAX_BPS_ONE_SIDE = 1000;
    uint16 internal constant TAX_MAX_BPS_SUM = 1500;
    uint64 internal constant LOCK_MIN_SECONDS = 30 days;
    uint64 internal constant LOCK_MAX_SECONDS = 5 * 365 days;
    uint16 internal constant LP_TOKEN_MAX_BPS = 9900;

    function validateName(string memory name) internal pure {
        bytes memory raw = bytes(name);
        uint256 len = raw.length;
        if (len < NAME_MIN_BYTES || len > NAME_MAX_BYTES) revert LaunchErrors.InvalidName();
        bytes memory trimmed = _trim(raw);
        if (trimmed.length == 0) revert LaunchErrors.InvalidName();
    }

    function validateSymbol(string memory symbol) internal pure {
        bytes memory raw = bytes(symbol);
        uint256 len = raw.length;
        if (len < SYMBOL_MIN_BYTES || len > SYMBOL_MAX_BYTES) revert LaunchErrors.InvalidSymbol();
        for (uint256 i; i < len; ++i) {
            bytes1 c = raw[i];
            bool ok = (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A);
            if (!ok) revert LaunchErrors.InvalidSymbol();
        }
    }

    function validateDecimals(uint8 decimals_) internal pure {
        if (decimals_ < DECIMALS_MIN || decimals_ > DECIMALS_MAX) {
            revert LaunchErrors.DecimalsOutOfRange(decimals_);
        }
    }

    function validateSupply(uint256 supply) internal pure {
        if (supply == 0) revert LaunchErrors.SupplyZero();
        if (supply > MAX_SUPPLY) revert LaunchErrors.SupplyOverflow();
    }

    function validateSupplyMode(uint8 mode) internal pure {
        if (mode > uint8(type(LaunchEnums.SupplyMode).max)) revert LaunchErrors.InvalidSupplyMode(mode);
    }

    function validateChainKey(uint8 chain) internal pure {
        if (chain > uint8(type(LaunchEnums.ChainKey).max)) revert LaunchErrors.InvalidChainKey(chain);
    }

    function validateDexKind(uint8 dex) internal pure {
        if (dex > uint8(type(LaunchEnums.DexKind).max)) revert LaunchErrors.InvalidDexKind(dex);
    }

    function validateLockMode(uint8 mode) internal pure {
        if (mode > uint8(type(LaunchEnums.LockMode).max)) revert LaunchErrors.InvalidLockMode(mode);
    }

    function validateOwnershipAction(uint8 action) internal pure {
        if (action > uint8(type(LaunchEnums.OwnershipAction).max)) {
            revert LaunchErrors.InvalidOwnershipAction(action);
        }
    }

    function validateLaunchStep(uint8 step) internal pure {
        if (step > uint8(type(LaunchEnums.LaunchStep).max)) revert LaunchErrors.InvalidLaunchStep(step);
    }

    function validateLaunchStatus(uint8 status) internal pure {
        if (status > uint8(type(LaunchEnums.LaunchStatus).max)) revert LaunchErrors.InvalidLaunchStatus(status);
    }

    function validateModuleFlags(uint16 flags) internal pure {
        if (flags & ~LaunchEnums.MODULE_ALL_MASK != 0) revert LaunchErrors.UnknownModule(flags);
    }

    function validateTax(uint16 buyBps, uint16 sellBps, address recipient) internal pure {
        if (buyBps > TAX_MAX_BPS_ONE_SIDE) revert LaunchErrors.TaxTooHigh(buyBps);
        if (sellBps > TAX_MAX_BPS_ONE_SIDE) revert LaunchErrors.TaxTooHigh(sellBps);
        if (uint256(buyBps) + uint256(sellBps) > TAX_MAX_BPS_SUM) {
            revert LaunchErrors.TaxTooHigh(buyBps + sellBps);
        }
        if ((buyBps > 0 || sellBps > 0) && recipient == address(0)) revert LaunchErrors.RecipientZero();
    }

    function validateLock(uint8 mode, uint64 duration) internal pure {
        validateLockMode(mode);
        if (LaunchEnums.LockMode(mode) == LaunchEnums.LockMode.Burn) {
            return;
        }
        if (duration < LOCK_MIN_SECONDS || duration > LOCK_MAX_SECONDS) {
            revert LaunchErrors.LockDurationInvalid(duration);
        }
    }

    function validateLimits(uint256 maxTx, uint256 maxWallet, uint256 totalSupply) internal pure {
        if (maxTx == 0 || maxWallet == 0) revert LaunchErrors.ZeroAmount();
        if (maxTx > totalSupply || maxWallet > totalSupply) revert LaunchErrors.SupplyOverflow();
        if (maxTx > maxWallet) revert LaunchErrors.SupplyOverflow();
    }

    function validateNonZeroAddress(address account) internal pure {
        if (account == address(0)) revert LaunchErrors.RecipientZero();
    }

    function validateBasics(string memory name, string memory symbol, uint8 decimals_, uint256 supply) internal pure {
        validateName(name);
        validateSymbol(symbol);
        validateDecimals(decimals_);
        validateSupply(supply);
    }

    function _trim(bytes memory s) private pure returns (bytes memory) {
        uint256 start;
        uint256 end = s.length;
        while (start < end && s[start] == 0x20) ++start;
        while (end > start && s[end - 1] == 0x20) --end;
        bytes memory out = new bytes(end - start);
        for (uint256 i; i < out.length; ++i) {
            out[i] = s[start + i];
        }
        return out;
    }
}
