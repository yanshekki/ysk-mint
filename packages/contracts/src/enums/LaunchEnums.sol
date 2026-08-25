// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @notice Canonical enums. Values are uint8 from 0. TypeScript mirrors these numbers exactly.
library LaunchEnums {
    enum ChainKey {
        Ethereum,
        Base,
        Arbitrum,
        Optimism,
        Bnb,
        BaseSepolia,
        ArbSepolia,
        Avalanche,
        Cardano,
        Near,
        EthereumSepolia,
        AvalancheFuji,
        BnbTestnet,
        CardanoPreprod,
        NearTestnet
    }

    enum DexKind {
        UniswapV2,
        PancakeV2,
        UniswapV3
    }

    enum LockMode {
        Timed,
        Burn
    }

    enum OwnershipAction {
        Keep,
        Renounce,
        TransferSafe,
        TransferTimelock
    }

    enum SupplyMode {
        Fixed,
        Mintable
    }

    enum LaunchStep {
        Wallet,
        Basics,
        Tokenomics,
        Chains,
        Liquidity,
        Omnichain,
        Review,
        Execute,
        Success
    }

    enum LaunchStatus {
        Draft,
        Simulating,
        AwaitingSignature,
        Submitted,
        Confirming,
        Partial,
        Failed,
        Complete
    }

    enum ModuleFlag {
        Pause,
        MaxTx,
        MaxWallet,
        Blacklist,
        Whitelist,
        AntiSnipe,
        BuyTax,
        SellTax
    }

    enum SaleStatus {
        Pending,
        Active,
        Failed,
        Finalized
    }

    uint16 internal constant MODULE_ALL_MASK = (1 << 8) - 1;

    function moduleBit(ModuleFlag flag) internal pure returns (uint16) {
        return uint16(1) << uint8(flag);
    }
}
