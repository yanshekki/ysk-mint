// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {LiquidityLocker} from "../src/liquidity/LiquidityLocker.sol";
import {ILiquidityLocker} from "../src/interfaces/ILiquidityLocker.sol";
import {LaunchEnums} from "../src/enums/LaunchEnums.sol";
import {LaunchErrors} from "../src/errors/LaunchErrors.sol";

contract MockLPToken is ERC20 {
    constructor() ERC20("LP", "LP") {
        _mint(msg.sender, 1_000 ether);
    }
}

contract LiquidityLockerTest is Test {
    LiquidityLocker internal locker;
    MockLPToken internal lp;
    address internal user = address(0xA11CE);

    function setUp() public {
        locker = new LiquidityLocker();
        lp = new MockLPToken();
        lp.transfer(user, 100 ether);
        vm.startPrank(user);
        lp.approve(address(locker), type(uint256).max);
        vm.stopPrank();
    }

    function test_timedLock_cannotWithdrawEarly() public {
        vm.prank(user);
        uint256 id = locker.lock(address(lp), 10 ether, uint8(LaunchEnums.LockMode.Timed), 30 days, user);
        ILiquidityLocker.Lock memory item = locker.getLock(id);
        assertEq(item.amount, 10 ether);
        assertEq(item.owner, user);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(LaunchErrors.LockNotMature.selector, item.unlockAt));
        locker.withdraw(id);
    }

    function test_timedLock_withdrawAfter() public {
        vm.prank(user);
        uint256 id = locker.lock(address(lp), 10 ether, uint8(LaunchEnums.LockMode.Timed), 30 days, user);
        vm.warp(block.timestamp + 30 days);
        vm.prank(user);
        locker.withdraw(id);
        assertEq(lp.balanceOf(user), 100 ether);
        assertTrue(locker.getLock(id).withdrawn);
    }

    function test_burn_isIrreversible() public {
        vm.prank(user);
        uint256 id = locker.lock(address(lp), 5 ether, uint8(LaunchEnums.LockMode.Burn), 0, user);
        assertEq(lp.balanceOf(address(0xdead)), 5 ether);
        vm.prank(user);
        vm.expectRevert(LaunchErrors.AlreadyWithdrawn.selector);
        locker.withdraw(id);
    }

    function test_notOwner() public {
        vm.prank(user);
        uint256 id = locker.lock(address(lp), 1 ether, uint8(LaunchEnums.LockMode.Timed), 30 days, user);
        vm.expectRevert(LaunchErrors.NotLockOwner.selector);
        locker.withdraw(id);
    }

    function test_invalidDuration() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(LaunchErrors.LockDurationInvalid.selector, uint64(1 days)));
        locker.lock(address(lp), 1 ether, uint8(LaunchEnums.LockMode.Timed), 1 days, user);
    }
}
