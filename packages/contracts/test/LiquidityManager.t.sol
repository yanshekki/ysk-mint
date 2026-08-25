// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Test} from "forge-std/Test.sol";
import {TokenFactory} from "../src/factory/TokenFactory.sol";
import {YskOFT} from "../src/token/YskOFT.sol";
import {IYskOFT} from "../src/interfaces/IYskOFT.sol";
import {LiquidityLocker} from "../src/liquidity/LiquidityLocker.sol";
import {LiquidityManager} from "../src/liquidity/LiquidityManager.sol";
import {LaunchEnums} from "../src/enums/LaunchEnums.sol";
import {LaunchErrors} from "../src/errors/LaunchErrors.sol";
import {MockEndpoint} from "./mocks/MockEndpoint.sol";
import {MockV2Router} from "./mocks/MockV2Router.sol";

contract LiquidityManagerTest is Test {
    MockEndpoint internal endpoint;
    TokenFactory internal factory;
    LiquidityLocker internal locker;
    LiquidityManager internal manager;
    MockV2Router internal router;
    address internal user = address(0xD00D);

    function setUp() public {
        endpoint = new MockEndpoint();
        factory = new TokenFactory(address(endpoint));
        locker = new LiquidityLocker();
        manager = new LiquidityManager(address(locker));
        router = new MockV2Router();
        vm.deal(user, 10 ether);
    }

    function _token() internal returns (YskOFT token) {
        token = YskOFT(
            factory.createToken(
                IYskOFT.InitParams({
                    name: "PoolCoin",
                    symbol: "POOL",
                    decimals: 18,
                    totalSupply: 1_000 ether,
                    owner: user,
                    supplyMode: uint8(LaunchEnums.SupplyMode.Fixed),
                    moduleFlags: 0
                }),
                keccak256("pool")
            )
        );
    }

    function test_addAndLock_timed() public {
        YskOFT token = _token();
        vm.startPrank(user);
        token.approve(address(manager), 100 ether);
        (uint256 lockId, uint256 liquidity, address lpToken) = manager.addAndLock{value: 1 ether}(
            address(token),
            address(router),
            100 ether,
            0,
            0,
            uint8(LaunchEnums.LockMode.Timed),
            30 days
        );
        vm.stopPrank();
        assertGt(liquidity, 0);
        assertEq(lockId, 1);
        assertEq(locker.getLock(lockId).token, lpToken);
        assertEq(locker.getLock(lockId).amount, liquidity);
        assertEq(locker.getLock(lockId).owner, user);
    }

    function test_addAndLock_burn() public {
        YskOFT token = _token();
        vm.startPrank(user);
        token.approve(address(manager), 50 ether);
        (uint256 lockId,,) = manager.addAndLock{value: 0.5 ether}(
            address(token), address(router), 50 ether, 0, 0, uint8(LaunchEnums.LockMode.Burn), 0
        );
        vm.stopPrank();
        assertTrue(locker.getLock(lockId).withdrawn);
        vm.expectRevert(LaunchErrors.AlreadyWithdrawn.selector);
        vm.prank(user);
        locker.withdraw(lockId);
    }

    function test_rejectsZeroNative() public {
        YskOFT token = _token();
        vm.startPrank(user);
        token.approve(address(manager), 1 ether);
        vm.expectRevert(LaunchErrors.ZeroAmount.selector);
        manager.addAndLock(address(token), address(router), 1 ether, 0, 0, uint8(LaunchEnums.LockMode.Burn), 0);
        vm.stopPrank();
    }
}
