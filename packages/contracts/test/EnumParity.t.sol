// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {LaunchEnums} from "../src/enums/LaunchEnums.sol";

contract EnumParityTest is Test {
    using stdJson for string;

    function test_enumNumbersMatchLockFile() public view {
        string memory json = vm.readFile("packages/config/enum-parity.json");
        assertEq(uint8(LaunchEnums.ChainKey.Ethereum), uint8(json.readUint(".ChainKey.Ethereum")));
        assertEq(uint8(LaunchEnums.ChainKey.Base), uint8(json.readUint(".ChainKey.Base")));
        assertEq(uint8(LaunchEnums.ChainKey.Arbitrum), uint8(json.readUint(".ChainKey.Arbitrum")));
        assertEq(uint8(LaunchEnums.ChainKey.Optimism), uint8(json.readUint(".ChainKey.Optimism")));
        assertEq(uint8(LaunchEnums.ChainKey.Bnb), uint8(json.readUint(".ChainKey.Bnb")));
        assertEq(uint8(LaunchEnums.ChainKey.BaseSepolia), uint8(json.readUint(".ChainKey.BaseSepolia")));
        assertEq(uint8(LaunchEnums.ChainKey.ArbSepolia), uint8(json.readUint(".ChainKey.ArbSepolia")));
        assertEq(uint8(LaunchEnums.ChainKey.Avalanche), uint8(json.readUint(".ChainKey.Avalanche")));
        assertEq(uint8(LaunchEnums.ChainKey.Cardano), uint8(json.readUint(".ChainKey.Cardano")));
        assertEq(uint8(LaunchEnums.ChainKey.Near), uint8(json.readUint(".ChainKey.Near")));
        assertEq(uint8(LaunchEnums.ChainKey.EthereumSepolia), uint8(json.readUint(".ChainKey.EthereumSepolia")));
        assertEq(uint8(LaunchEnums.ChainKey.AvalancheFuji), uint8(json.readUint(".ChainKey.AvalancheFuji")));
        assertEq(uint8(LaunchEnums.ChainKey.BnbTestnet), uint8(json.readUint(".ChainKey.BnbTestnet")));
        assertEq(uint8(LaunchEnums.ChainKey.CardanoPreprod), uint8(json.readUint(".ChainKey.CardanoPreprod")));
        assertEq(uint8(LaunchEnums.ChainKey.NearTestnet), uint8(json.readUint(".ChainKey.NearTestnet")));
        assertEq(uint8(LaunchEnums.ChainKey.Solana), uint8(json.readUint(".ChainKey.Solana")));
        assertEq(uint8(LaunchEnums.ChainKey.SolanaDevnet), uint8(json.readUint(".ChainKey.SolanaDevnet")));
        assertEq(uint8(LaunchEnums.ChainKey.Polygon), uint8(json.readUint(".ChainKey.Polygon")));
        assertEq(uint8(LaunchEnums.ChainKey.Fantom), uint8(json.readUint(".ChainKey.Fantom")));
        assertEq(uint8(LaunchEnums.ChainKey.Mantle), uint8(json.readUint(".ChainKey.Mantle")));
        assertEq(uint8(LaunchEnums.ChainKey.WorldChain), uint8(json.readUint(".ChainKey.WorldChain")));
        assertEq(uint8(LaunchEnums.ChainKey.HyperEvm), uint8(json.readUint(".ChainKey.HyperEvm")));
        assertEq(uint8(LaunchEnums.ChainKey.Tron), uint8(json.readUint(".ChainKey.Tron")));
        assertEq(uint8(LaunchEnums.ChainKey.Sui), uint8(json.readUint(".ChainKey.Sui")));
        assertEq(uint8(LaunchEnums.ChainKey.Ton), uint8(json.readUint(".ChainKey.Ton")));
        assertEq(uint8(LaunchEnums.ChainKey.HyperCore), uint8(json.readUint(".ChainKey.HyperCore")));
        assertEq(uint8(LaunchEnums.ChainKey.Aptos), uint8(json.readUint(".ChainKey.Aptos")));
        assertEq(uint8(LaunchEnums.ChainKey.Monad), uint8(json.readUint(".ChainKey.Monad")));
        assertEq(uint8(LaunchEnums.ChainKey.Robinhood), uint8(json.readUint(".ChainKey.Robinhood")));

        assertEq(uint8(LaunchEnums.DexKind.UniswapV2), uint8(json.readUint(".DexKind.UniswapV2")));
        assertEq(uint8(LaunchEnums.DexKind.PancakeV2), uint8(json.readUint(".DexKind.PancakeV2")));
        assertEq(uint8(LaunchEnums.DexKind.UniswapV3), uint8(json.readUint(".DexKind.UniswapV3")));

        assertEq(uint8(LaunchEnums.LockMode.Timed), uint8(json.readUint(".LockMode.Timed")));
        assertEq(uint8(LaunchEnums.LockMode.Burn), uint8(json.readUint(".LockMode.Burn")));

        assertEq(uint8(LaunchEnums.OwnershipAction.Keep), uint8(json.readUint(".OwnershipAction.Keep")));
        assertEq(uint8(LaunchEnums.OwnershipAction.Renounce), uint8(json.readUint(".OwnershipAction.Renounce")));
        assertEq(
            uint8(LaunchEnums.OwnershipAction.TransferSafe), uint8(json.readUint(".OwnershipAction.TransferSafe"))
        );
        assertEq(
            uint8(LaunchEnums.OwnershipAction.TransferTimelock),
            uint8(json.readUint(".OwnershipAction.TransferTimelock"))
        );

        assertEq(uint8(LaunchEnums.SupplyMode.Fixed), uint8(json.readUint(".SupplyMode.Fixed")));
        assertEq(uint8(LaunchEnums.SupplyMode.Mintable), uint8(json.readUint(".SupplyMode.Mintable")));

        assertEq(uint8(LaunchEnums.LaunchStep.Wallet), uint8(json.readUint(".LaunchStep.Wallet")));
        assertEq(uint8(LaunchEnums.LaunchStep.Success), uint8(json.readUint(".LaunchStep.Success")));
        assertEq(uint8(LaunchEnums.LaunchStatus.Draft), uint8(json.readUint(".LaunchStatus.Draft")));
        assertEq(uint8(LaunchEnums.LaunchStatus.Complete), uint8(json.readUint(".LaunchStatus.Complete")));

        assertEq(uint8(LaunchEnums.ModuleFlag.Pause), uint8(json.readUint(".ModuleFlag.Pause")));
        assertEq(uint8(LaunchEnums.ModuleFlag.SellTax), uint8(json.readUint(".ModuleFlag.SellTax")));
        assertEq(uint8(LaunchEnums.SaleStatus.Pending), uint8(json.readUint(".SaleStatus.Pending")));
        assertEq(uint8(LaunchEnums.SaleStatus.Finalized), uint8(json.readUint(".SaleStatus.Finalized")));
    }
}
