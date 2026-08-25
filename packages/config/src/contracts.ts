import { ChainKey } from "./enums";

export type LaunchContracts = {
  factory: `0x${string}`;
  manager: `0x${string}`;
  locker: `0x${string}`;
  v2Router: `0x${string}`;
};

const ZERO = "0x0000000000000000000000000000000000000000" as const;

/** Filled after a testnet deploy. Zero means the wizard will refuse to send. */
export const LAUNCH_CONTRACTS: Partial<Record<(typeof ChainKey)[keyof typeof ChainKey], LaunchContracts>> = {
  [ChainKey.BaseSepolia]: {
    factory: ZERO,
    manager: ZERO,
    locker: ZERO,
    v2Router: ZERO,
  },
  [ChainKey.ArbSepolia]: {
    factory: ZERO,
    manager: ZERO,
    locker: ZERO,
    v2Router: ZERO,
  },
};

export function launchContracts(chainKey: number): LaunchContracts | undefined {
  return LAUNCH_CONTRACTS[chainKey as keyof typeof LAUNCH_CONTRACTS];
}

export function isConfigured(c: LaunchContracts | undefined): c is LaunchContracts {
  return Boolean(c && c.factory !== ZERO && c.manager !== ZERO && c.locker !== ZERO && c.v2Router !== ZERO);
}
