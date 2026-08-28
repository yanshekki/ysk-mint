// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Test} from "forge-std/Test.sol";
import {YskOFT} from "../src/token/YskOFT.sol";
import {IYskOFT} from "../src/interfaces/IYskOFT.sol";
import {ILayerZeroEndpointV2} from "../src/interfaces/ILayerZeroEndpointV2.sol";
import {LaunchErrors} from "../src/errors/LaunchErrors.sol";
import {LaunchEnums} from "../src/enums/LaunchEnums.sol";
import {MockEndpoint} from "./mocks/MockEndpoint.sol";

contract YskOFTTest is Test {
    MockEndpoint internal endpoint;
    YskOFT internal impl;
    YskOFT internal token;
    address internal owner = address(0xA11CE);

    function setUp() public {
        endpoint = new MockEndpoint();
        impl = new YskOFT(address(endpoint));
        token = new YskOFT(address(endpoint));
        vm.deal(owner, 1 ether);
        IYskOFT.InitParams memory params = IYskOFT.InitParams({
            name: "YSK Token",
            symbol: "YSK",
            decimals: 18,
            totalSupply: 1_000_000 ether,
            owner: owner,
            supplyMode: uint8(LaunchEnums.SupplyMode.Fixed),
            moduleFlags: 0
        });
        token.initialize(params);
    }

    function test_initialize_and_metadata() public view {
        assertEq(token.name(), "YSK Token");
        assertEq(token.symbol(), "YSK");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 1_000_000 ether);
        assertEq(token.balanceOf(owner), 1_000_000 ether);
        assertEq(token.owner(), owner);
    }

    function test_initialize_twice() public {
        IYskOFT.InitParams memory params = IYskOFT.InitParams({
            name: "YSK Token",
            symbol: "YSK",
            decimals: 18,
            totalSupply: 1,
            owner: owner,
            supplyMode: 0,
            moduleFlags: 0
        });
        vm.expectRevert(LaunchErrors.AlreadyInitialized.selector);
        token.initialize(params);
    }

    function test_fixed_cannotMint() public {
        vm.prank(owner);
        vm.expectRevert(LaunchErrors.MintNotAllowed.selector);
        token.mint(owner, 1);
    }

    function test_mintable() public {
        YskOFT mintable = new YskOFT(address(endpoint));
        mintable.initialize(
            IYskOFT.InitParams({
                name: "Minty",
                symbol: "MINT",
                decimals: 18,
                totalSupply: 1 ether,
                owner: owner,
                supplyMode: uint8(LaunchEnums.SupplyMode.Mintable),
                moduleFlags: 0
            })
        );
        vm.prank(owner);
        mintable.mint(address(0xB0B), 2 ether);
        assertEq(mintable.balanceOf(address(0xB0B)), 2 ether);
    }

    function test_send_requiresPeer() public {
        IYskOFT.SendParam memory sp = IYskOFT.SendParam({
            dstEid: 40231,
            to: bytes32(uint256(uint160(owner))),
            amountLD: 1 ether,
            minAmountLD: 1 ether,
            extraOptions: "",
            composeMsg: "",
            oftCmd: ""
        });
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(LaunchErrors.PeerNotSet.selector, uint32(40231)));
        token.send(sp, ILayerZeroEndpointV2.MessagingFee({nativeFee: 0, lzTokenFee: 0}), owner);
    }

    function test_oft_sendAndReceive() public {
        uint32 dstEid = 40231;
        vm.prank(owner);
        token.setPeer(dstEid, bytes32(uint256(uint160(address(token)))));

        YskOFT dest = new YskOFT(address(endpoint));
        dest.initialize(
            IYskOFT.InitParams({
                name: "YSK Token",
                symbol: "YSK",
                decimals: 18,
                totalSupply: 1,
                owner: owner,
                supplyMode: uint8(LaunchEnums.SupplyMode.Mintable),
                moduleFlags: 0
            })
        );
        vm.prank(owner);
        dest.setPeer(40245, bytes32(uint256(uint160(address(token)))));

        IYskOFT.SendParam memory sp = IYskOFT.SendParam({
            dstEid: dstEid,
            to: bytes32(uint256(uint160(address(0xBEEF)))),
            amountLD: 10 ether,
            minAmountLD: 10 ether,
            extraOptions: "",
            composeMsg: "",
            oftCmd: ""
        });
        vm.prank(owner);
        token.send{value: 0.01 ether}(sp, ILayerZeroEndpointV2.MessagingFee({nativeFee: 0.01 ether, lzTokenFee: 0}), owner);
        assertEq(token.balanceOf(owner), 1_000_000 ether - 10 ether);
        assertEq(endpoint.lastOptions(), hex"00030100110100000000000000000000000000030d40");

        bytes memory payload = abi.encode(bytes32(uint256(uint160(address(0xBEEF)))), uint256(10 ether));
        endpoint.deliver(address(dest), 40245, bytes32(uint256(uint160(address(token)))), bytes32("g"), payload);
        assertEq(dest.balanceOf(address(0xBEEF)), 10 ether);
    }

    function test_allowInitializePath() public {
        vm.prank(owner);
        token.setPeer(40231, bytes32(uint256(uint160(address(0xBEEF)))));
        ILayerZeroEndpointV2.Origin memory ok =
            ILayerZeroEndpointV2.Origin({srcEid: 40231, sender: bytes32(uint256(uint160(address(0xBEEF)))), nonce: 1});
        assertTrue(token.allowInitializePath(ok));
        ILayerZeroEndpointV2.Origin memory bad =
            ILayerZeroEndpointV2.Origin({srcEid: 40231, sender: bytes32(uint256(uint160(address(this)))), nonce: 1});
        assertFalse(token.allowInitializePath(bad));
        assertEq(token.nextNonce(40231, bytes32(0)), 0);
    }

    function test_lzReceive_rejectsWrongCaller() public {
        vm.prank(owner);
        token.setPeer(40231, bytes32(uint256(uint160(address(this)))));
        ILayerZeroEndpointV2.Origin memory origin =
            ILayerZeroEndpointV2.Origin({srcEid: 40231, sender: bytes32(uint256(uint160(address(this)))), nonce: 1});
        bytes memory payload = abi.encode(bytes32(uint256(uint160(owner))), uint256(1 ether));
        vm.expectRevert(LaunchErrors.NotOwner.selector);
        token.lzReceive(origin, bytes32("g"), payload, address(this), "");
    }
}
