export const ErrorCode = {
  InvalidName: "InvalidName",
  InvalidSymbol: "InvalidSymbol",
  DecimalsOutOfRange: "DecimalsOutOfRange",
  SupplyZero: "SupplyZero",
  SupplyOverflow: "SupplyOverflow",
  TaxTooHigh: "TaxTooHigh",
  RecipientZero: "RecipientZero",
  LockDurationInvalid: "LockDurationInvalid",
  DexUnsupported: "DexUnsupported",
  ChainDisabled: "ChainDisabled",
  InsufficientNative: "InsufficientNative",
  LockNotMature: "LockNotMature",
  NotLockOwner: "NotLockOwner",
  PeerAlreadySet: "PeerAlreadySet",
  PeerNotSet: "PeerNotSet",
  ModuleDisabled: "ModuleDisabled",
  OFTPathMustBeFeeFree: "OFTPathMustBeFeeFree",
  AlreadyInitialized: "AlreadyInitialized",
  NotOwner: "NotOwner",
  UnknownModule: "UnknownModule",
  InvalidSupplyMode: "InvalidSupplyMode",
  InvalidLockMode: "InvalidLockMode",
  InvalidOwnershipAction: "InvalidOwnershipAction",
  MintNotAllowed: "MintNotAllowed",
  InvalidPeer: "InvalidPeer",
  InsufficientBalance: "InsufficientBalance",
  ZeroAmount: "ZeroAmount",
  CloneFailed: "CloneFailed",
  InvalidChainKey: "InvalidChainKey",
  InvalidDexKind: "InvalidDexKind",
  InvalidLaunchStep: "InvalidLaunchStep",
  InvalidLaunchStatus: "InvalidLaunchStatus",
  NotInitialized: "NotInitialized",
  EndpointZero: "EndpointZero",
  LengthMismatch: "LengthMismatch",
  LockNotFound: "LockNotFound",
  AlreadyWithdrawn: "AlreadyWithdrawn",
  NativeTransferFailed: "NativeTransferFailed",
  Paused: "Paused",
  MaxTxExceeded: "MaxTxExceeded",
  MaxWalletExceeded: "MaxWalletExceeded",
  Blacklisted: "Blacklisted",
  BondingDisabled: "BondingDisabled",
  SaleNotActive: "SaleNotActive",
  SaleCapExceeded: "SaleCapExceeded",
  SaleNotFailed: "SaleNotFailed",
  SaleNotFinalizable: "SaleNotFinalizable",
  PlatformFeeTooHigh: "PlatformFeeTooHigh",
  Unknown: "Unknown",
  SimulationFailed: "SimulationFailed",
} as const;

export type ErrorCodeName = (typeof ErrorCode)[keyof typeof ErrorCode];

export type LaunchErrorSeverity = "user" | "chain" | "fatal";

export type LaunchError = {
  code: ErrorCodeName;
  args: unknown[];
  severity: LaunchErrorSeverity;
  retryable: boolean;
  message?: string;
};

export const USER_CODES: ReadonlySet<string> = new Set([
  ErrorCode.InvalidName,
  ErrorCode.InvalidSymbol,
  ErrorCode.DecimalsOutOfRange,
  ErrorCode.SupplyZero,
  ErrorCode.SupplyOverflow,
  ErrorCode.TaxTooHigh,
  ErrorCode.RecipientZero,
  ErrorCode.LockDurationInvalid,
  ErrorCode.DexUnsupported,
  ErrorCode.ChainDisabled,
  ErrorCode.UnknownModule,
  ErrorCode.InvalidSupplyMode,
  ErrorCode.InvalidLockMode,
  ErrorCode.InvalidOwnershipAction,
  ErrorCode.InvalidChainKey,
  ErrorCode.InvalidDexKind,
  ErrorCode.ZeroAmount,
  ErrorCode.LengthMismatch,
  ErrorCode.LockNotFound,
  ErrorCode.AlreadyWithdrawn,
  ErrorCode.Paused,
  ErrorCode.MaxTxExceeded,
  ErrorCode.MaxWalletExceeded,
  ErrorCode.Blacklisted,
]);

export const RETRYABLE_CODES: ReadonlySet<string> = new Set([
  ErrorCode.InsufficientNative,
  ErrorCode.InsufficientBalance,
  ErrorCode.SimulationFailed,
]);
