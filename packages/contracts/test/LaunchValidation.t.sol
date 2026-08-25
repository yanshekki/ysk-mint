// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Test} from "forge-std/Test.sol";
import {LaunchValidation} from "../src/libraries/LaunchValidation.sol";
import {LaunchErrors} from "../src/errors/LaunchErrors.sol";
import {LaunchEnums} from "../src/enums/LaunchEnums.sol";

contract LaunchValidationHarness {
    function name(string memory v) external pure {
        LaunchValidation.validateName(v);
    }

    function symbol(string memory v) external pure {
        LaunchValidation.validateSymbol(v);
    }

    function decimals_(uint8 v) external pure {
        LaunchValidation.validateDecimals(v);
    }

    function supply(uint256 v) external pure {
        LaunchValidation.validateSupply(v);
    }

    function basics(string memory n, string memory s, uint8 d, uint256 supply_) external pure {
        LaunchValidation.validateBasics(n, s, d, supply_);
    }

    function supplyMode(uint8 v) external pure {
        LaunchValidation.validateSupplyMode(v);
    }

    function chainKey(uint8 v) external pure {
        LaunchValidation.validateChainKey(v);
    }

    function modules(uint16 v) external pure {
        LaunchValidation.validateModuleFlags(v);
    }

    function tax(uint16 buyBps, uint16 sellBps, address recipient) external pure {
        LaunchValidation.validateTax(buyBps, sellBps, recipient);
    }

    function lock(uint8 mode, uint64 duration) external pure {
        LaunchValidation.validateLock(mode, duration);
    }
}

contract LaunchValidationTest is Test {
    LaunchValidationHarness internal h;

    function setUp() public {
        h = new LaunchValidationHarness();
    }

    function test_name_ok() public view {
        h.name("YSK Token");
    }

    function test_name_empty() public {
        vm.expectRevert(LaunchErrors.InvalidName.selector);
        h.name("");
    }

    function test_name_whitespaceOnly() public {
        vm.expectRevert(LaunchErrors.InvalidName.selector);
        h.name("   ");
    }

    function test_name_tooLong() public {
        vm.expectRevert(LaunchErrors.InvalidName.selector);
        h.name("abcdefghijklmnopqrstuvwxyz0123456");
    }

    function test_symbol_ok() public view {
        h.symbol("YSK");
    }

    function test_symbol_space() public {
        vm.expectRevert(LaunchErrors.InvalidSymbol.selector);
        h.symbol("Y S");
    }

    function test_symbol_tooLong() public {
        vm.expectRevert(LaunchErrors.InvalidSymbol.selector);
        h.symbol("TOOLONGSYM12");
    }

    function test_decimals_bounds() public {
        vm.expectRevert(abi.encodeWithSelector(LaunchErrors.DecimalsOutOfRange.selector, uint8(5)));
        h.decimals_(5);
        vm.expectRevert(abi.encodeWithSelector(LaunchErrors.DecimalsOutOfRange.selector, uint8(19)));
        h.decimals_(19);
        h.decimals_(6);
        h.decimals_(18);
    }

    function test_supply_zeroAndOverflow() public {
        vm.expectRevert(LaunchErrors.SupplyZero.selector);
        h.supply(0);
        vm.expectRevert(LaunchErrors.SupplyOverflow.selector);
        h.supply(uint256(type(uint128).max) + 1);
        h.supply(1);
        h.supply(type(uint128).max);
    }

    function test_enum_outOfRange() public {
        vm.expectRevert(abi.encodeWithSelector(LaunchErrors.InvalidSupplyMode.selector, uint8(2)));
        h.supplyMode(2);
        vm.expectRevert(abi.encodeWithSelector(LaunchErrors.InvalidChainKey.selector, uint8(7)));
        h.chainKey(7);
        h.supplyMode(uint8(LaunchEnums.SupplyMode.Mintable));
        h.chainKey(uint8(LaunchEnums.ChainKey.ArbSepolia));
    }

    function test_unknownModuleBit() public {
        vm.expectRevert(abi.encodeWithSelector(LaunchErrors.UnknownModule.selector, uint16(1 << 8)));
        h.modules(uint16(1 << 8));
        h.modules(LaunchEnums.MODULE_ALL_MASK);
    }

    function test_tax_and_lock() public {
        vm.expectRevert(abi.encodeWithSelector(LaunchErrors.TaxTooHigh.selector, uint16(1001)));
        h.tax(1001, 0, address(this));
        vm.expectRevert(LaunchErrors.RecipientZero.selector);
        h.tax(100, 0, address(0));
        h.tax(0, 0, address(0));
        h.lock(uint8(LaunchEnums.LockMode.Burn), 0);
        vm.expectRevert(abi.encodeWithSelector(LaunchErrors.LockDurationInvalid.selector, uint64(1 days)));
        h.lock(uint8(LaunchEnums.LockMode.Timed), 1 days);
        h.lock(uint8(LaunchEnums.LockMode.Timed), 30 days);
    }
}
