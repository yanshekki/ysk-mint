// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Test} from "forge-std/Test.sol";
import {TokenFactory} from "../src/factory/TokenFactory.sol";
import {YskOFT} from "../src/token/YskOFT.sol";
import {IYskOFT} from "../src/interfaces/IYskOFT.sol";
import {LaunchEnums} from "../src/enums/LaunchEnums.sol";
import {LaunchErrors} from "../src/errors/LaunchErrors.sol";
import {MockEndpoint} from "./mocks/MockEndpoint.sol";

contract TokenFactoryTest is Test {
    MockEndpoint internal endpoint;
    TokenFactory internal factory;
    address internal deployer = address(0xD00D);

    function setUp() public {
        endpoint = new MockEndpoint();
        factory = new TokenFactory(address(endpoint));
    }

    function test_predictMatchesCreate() public {
        bytes32 salt = keccak256("ysk");
        address predicted = factory.predictToken(salt);
        IYskOFT.InitParams memory params = IYskOFT.InitParams({
            name: "FactoryCoin",
            symbol: "FACT",
            decimals: 18,
            totalSupply: 100 ether,
            owner: deployer,
            supplyMode: uint8(LaunchEnums.SupplyMode.Fixed),
            moduleFlags: 0
        });
        address token = factory.createToken(params, salt);
        assertEq(token, predicted);
        assertEq(YskOFT(token).name(), "FactoryCoin");
        assertEq(YskOFT(token).balanceOf(deployer), 100 ether);
        assertEq(YskOFT(token).endpoint(), address(endpoint));
    }

    function test_sameSaltReverts() public {
        bytes32 salt = keccak256("dup");
        IYskOFT.InitParams memory params = IYskOFT.InitParams({
            name: "FactoryCoin",
            symbol: "FACT",
            decimals: 18,
            totalSupply: 1 ether,
            owner: deployer,
            supplyMode: 0,
            moduleFlags: 0
        });
        factory.createToken(params, salt);
        vm.expectRevert();
        factory.createToken(params, salt);
    }

    function test_rejectBadName() public {
        vm.expectRevert(LaunchErrors.InvalidSymbol.selector);
        factory.createToken(
            IYskOFT.InitParams({
                name: "Ok",
                symbol: "BAD SYM",
                decimals: 18,
                totalSupply: 1,
                owner: deployer,
                supplyMode: 0,
                moduleFlags: 0
            }),
            bytes32("s")
        );
    }

    function test_constructorRejectsZeroEndpoint() public {
        vm.expectRevert(LaunchErrors.RecipientZero.selector);
        new TokenFactory(address(0));
    }
}
