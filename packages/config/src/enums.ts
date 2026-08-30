import parity from "../enum-parity.json" with { type: "json" };

export const ChainKey = parity.ChainKey;
export const DexKind = parity.DexKind;
export const LockMode = parity.LockMode;
export const OwnershipAction = parity.OwnershipAction;
export const SupplyMode = parity.SupplyMode;
export const LaunchStep = parity.LaunchStep;
export const LaunchStatus = parity.LaunchStatus;
export const ModuleFlag = parity.ModuleFlag;
export const SaleStatus = parity.SaleStatus;

export type ChainKeyName = keyof typeof ChainKey;
export type DexKindName = keyof typeof DexKind;
export type LockModeName = keyof typeof LockMode;
export type OwnershipActionName = keyof typeof OwnershipAction;
export type SupplyModeName = keyof typeof SupplyMode;
export type LaunchStepName = keyof typeof LaunchStep;
export type LaunchStatusName = keyof typeof LaunchStatus;
export type ModuleFlagName = keyof typeof ModuleFlag;

export const MODULE_ALL_MASK = (1 << 8) - 1;

export function moduleBit(flag: (typeof ModuleFlag)[ModuleFlagName]): number {
  return 1 << flag;
}
