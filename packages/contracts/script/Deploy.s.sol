// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script, console2} from "forge-std/Script.sol";
import {TokenFactory} from "../src/factory/TokenFactory.sol";
import {LiquidityLocker} from "../src/liquidity/LiquidityLocker.sol";
import {LiquidityManager} from "../src/liquidity/LiquidityManager.sol";

/// @notice Broadcast on a testnet: forge script packages/contracts/script/Deploy.s.sol --rpc-url $RPC --broadcast
contract DeployScript is Script {
    function run() external {
        address endpoint = vm.envAddress("LZ_ENDPOINT");
        vm.startBroadcast();
        TokenFactory factory = new TokenFactory(endpoint);
        LiquidityLocker locker = new LiquidityLocker();
        LiquidityManager manager = new LiquidityManager(address(locker));
        vm.stopBroadcast();
        console2.log("factory", address(factory));
        console2.log("locker", address(locker));
        console2.log("manager", address(manager));
        console2.log("oftImplementation", factory.implementation());
    }
}
