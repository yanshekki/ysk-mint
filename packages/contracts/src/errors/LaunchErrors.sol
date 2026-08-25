// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @notice All user/protocol errors. No require(string) on the happy/error path.
library LaunchErrors {
    error InvalidName();
    error InvalidSymbol();
    error DecimalsOutOfRange(uint8 got);
    error SupplyZero();
    error SupplyOverflow();
    error TaxTooHigh(uint16 bps);
    error RecipientZero();
    error LockDurationInvalid(uint64 seconds_);
    error DexUnsupported(uint8 dex);
    error ChainDisabled(uint8 chain);
    error InsufficientNative(uint256 have, uint256 need);
    error LockNotMature(uint256 unlockAt);
    error NotLockOwner();
    error PeerAlreadySet(uint32 eid);
    error PeerNotSet(uint32 eid);
    error ModuleDisabled(uint8 flag);
    error OFTPathMustBeFeeFree();
    error AlreadyInitialized();
    error NotOwner();
    error UnknownModule(uint16 flags);
    error InvalidSupplyMode(uint8 mode);
    error InvalidLockMode(uint8 mode);
    error InvalidOwnershipAction(uint8 action);
    error MintNotAllowed();
    error InvalidPeer();
    error InsufficientBalance(uint256 have, uint256 need);
    error ZeroAmount();
    error CloneFailed();
    error InvalidChainKey(uint8 chain);
    error InvalidDexKind(uint8 dex);
    error InvalidLaunchStep(uint8 step);
    error InvalidLaunchStatus(uint8 status);
    error NotInitialized();
    error EndpointZero();
    error LengthMismatch();
    error LockNotFound();
    error AlreadyWithdrawn();
    error NativeTransferFailed();
    error Paused();
    error MaxTxExceeded(uint256 amount, uint256 maxTx);
    error MaxWalletExceeded(uint256 balance, uint256 maxWallet);
    error Blacklisted();
}
