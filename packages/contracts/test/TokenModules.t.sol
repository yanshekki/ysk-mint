// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Test} from "forge-std/Test.sol";
import {YskOFT} from "../src/token/YskOFT.sol";
import {IYskOFT} from "../src/interfaces/IYskOFT.sol";
import {LaunchEnums} from "../src/enums/LaunchEnums.sol";
import {LaunchErrors} from "../src/errors/LaunchErrors.sol";
import {LiquidityManager} from "../src/liquidity/LiquidityManager.sol";
import {LiquidityLocker} from "../src/liquidity/LiquidityLocker.sol";
import {MockEndpoint} from "./mocks/MockEndpoint.sol";
import {ILayerZeroEndpointV2} from "../src/interfaces/ILayerZeroEndpointV2.sol";

contract TokenModulesTest is Test {
    MockEndpoint internal endpoint;
    YskOFT internal token;
    address internal owner = address(0xA11CE);
    address internal user = address(0xB0B);

    function setUp() public {
        endpoint = new MockEndpoint();
        token = new YskOFT(address(endpoint));
        uint16 flags = LaunchEnums.moduleBit(LaunchEnums.ModuleFlag.Pause)
            | LaunchEnums.moduleBit(LaunchEnums.ModuleFlag.MaxTx)
            | LaunchEnums.moduleBit(LaunchEnums.ModuleFlag.MaxWallet)
            | LaunchEnums.moduleBit(LaunchEnums.ModuleFlag.Blacklist)
            | LaunchEnums.moduleBit(LaunchEnums.ModuleFlag.BuyTax);
        token.initialize(
            IYskOFT.InitParams({
                name: "ModCoin",
                symbol: "MOD",
                decimals: 18,
                totalSupply: 1000 ether,
                owner: owner,
                supplyMode: uint8(LaunchEnums.SupplyMode.Mintable),
                moduleFlags: flags
            })
        );
        vm.prank(owner);
        token.transfer(user, 100 ether);
        vm.deal(owner, 1 ether);
    }

    function test_pause_blocksTransfer_notMint() public {
        vm.prank(owner);
        token.setPaused(true);
        vm.prank(user);
        vm.expectRevert(LaunchErrors.Paused.selector);
        token.transfer(owner, 1 ether);
        vm.prank(owner);
        token.mint(user, 1 ether);
        assertEq(token.balanceOf(user), 101 ether);
    }

    function test_maxTx() public {
        vm.prank(owner);
        token.setLimits(5 ether, 50 ether);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(LaunchErrors.MaxTxExceeded.selector, uint256(6 ether), uint256(5 ether)));
        token.transfer(owner, 6 ether);
    }

    function test_blacklist() public {
        vm.prank(owner);
        token.setBlacklisted(user, true);
        vm.prank(user);
        vm.expectRevert(LaunchErrors.Blacklisted.selector);
        token.transfer(owner, 1 ether);
    }

    function test_oftSend_skipsTaxAndLimits() public {
        vm.prank(owner);
        token.setLimits(1, 50 ether);
        vm.prank(owner);
        token.setPeer(40231, bytes32(uint256(uint160(address(token)))));
        IYskOFT.SendParam memory sp = IYskOFT.SendParam({
            dstEid: 40231,
            to: bytes32(uint256(uint160(user))),
            amountLD: 10 ether,
            minAmountLD: 10 ether,
            extraOptions: "",
            composeMsg: "",
            oftCmd: ""
        });
        vm.prank(owner);
        token.send{value: 0.01 ether}(sp, ILayerZeroEndpointV2.MessagingFee({nativeFee: 0.01 ether, lzTokenFee: 0}), owner);
        assertEq(token.balanceOf(owner), 890 ether);
    }

    function test_v3_dex_rejected() public {
        LiquidityLocker locker = new LiquidityLocker();
        LiquidityManager manager = new LiquidityManager(address(locker));
        vm.expectRevert(abi.encodeWithSelector(LaunchErrors.DexUnsupported.selector, uint8(LaunchEnums.DexKind.UniswapV3)));
        manager.addAndLockForDex{value: 1}(
            uint8(LaunchEnums.DexKind.UniswapV3), address(token), address(1), 1, 0, 0, 1, 0
        );
    }
}
