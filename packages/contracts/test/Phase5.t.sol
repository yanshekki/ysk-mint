// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Test} from "forge-std/Test.sol";
import {TokenFactory} from "../src/factory/TokenFactory.sol";
import {IYskOFT} from "../src/interfaces/IYskOFT.sol";
import {Presale} from "../src/sale/Presale.sol";
import {BondingCurve} from "../src/sale/BondingCurve.sol";
import {LaunchErrors} from "../src/errors/LaunchErrors.sol";
import {LaunchEnums} from "../src/enums/LaunchEnums.sol";
import {MockEndpoint} from "./mocks/MockEndpoint.sol";

contract Phase5Test is Test {
    function test_factoryFee_defaultZero() public {
        TokenFactory factory = new TokenFactory(address(new MockEndpoint()));
        assertEq(factory.platformFeeBps(), 0);
        assertEq(factory.flatNativeFee(), 0);
        factory.createToken(
            IYskOFT.InitParams({
                name: "ZeroFee",
                symbol: "ZERO",
                decimals: 18,
                totalSupply: 1 ether,
                owner: address(this),
                supplyMode: 0,
                moduleFlags: 0
            }),
            bytes32("z")
        );
    }

    function test_presale_refundWhenSoftCapMissed() public {
        Presale sale = new Presale(2 ether, 5 ether, 1 days);
        address user = address(0xABC);
        vm.deal(user, 1 ether);
        vm.prank(user);
        sale.contribute{value: 1 ether}();
        vm.warp(block.timestamp + 1 days);
        sale.finalize();
        assertEq(sale.status(), uint8(LaunchEnums.SaleStatus.Failed));
        vm.prank(user);
        sale.refund();
        assertEq(user.balance, 1 ether);
    }

    function test_bonding_disabled() public {
        BondingCurve curve = new BondingCurve();
        vm.expectRevert(LaunchErrors.BondingDisabled.selector);
        curve.buy{value: 1}();
    }

    function test_feeCap() public {
        TokenFactory factory = new TokenFactory(address(new MockEndpoint()));
        vm.expectRevert(abi.encodeWithSelector(LaunchErrors.PlatformFeeTooHigh.selector, uint16(501)));
        factory.setPlatformFee(501, 0, address(this));
    }
}
