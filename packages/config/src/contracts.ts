import { ChainKey } from "./enums";

export type LaunchContracts = {
  factory: `0x${string}`;
  manager: `0x${string}`;
  locker: `0x${string}`;
  v2Router: `0x${string}`;
};

const ZERO = "0x0000000000000000000000000000000000000000" as const;

/** Known UniV2-style routers. Factory / manager / locker stay zero until a deploy. */
const UNI_V2 = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" as const;
const UNI_V2_BASE_ARB = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24" as const;
const PANCAKE_V2 = "0x10ED43C718714eb63d5aA57B78B54704E256024E" as const;
const JOE_V1 = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4" as const;

function unset(v2Router: `0x${string}` = ZERO): LaunchContracts {
  return { factory: ZERO, manager: ZERO, locker: ZERO, v2Router };
}

/** Filled after a deploy. Zero factory means the wizard will refuse to send. */
export const LAUNCH_CONTRACTS: Partial<Record<(typeof ChainKey)[keyof typeof ChainKey], LaunchContracts>> = {
  [ChainKey.Ethereum]: unset(UNI_V2),
  [ChainKey.Base]: unset(UNI_V2_BASE_ARB),
  [ChainKey.Arbitrum]: unset(UNI_V2_BASE_ARB),
  [ChainKey.Bnb]: unset(PANCAKE_V2),
  [ChainKey.Avalanche]: unset(JOE_V1),
  [ChainKey.BaseSepolia]: unset(),
  [ChainKey.ArbSepolia]: unset(),
  [ChainKey.EthereumSepolia]: unset(),
  [ChainKey.AvalancheFuji]: unset(),
  [ChainKey.BnbTestnet]: unset(),
};

export function launchContracts(chainKey: number): LaunchContracts | undefined {
  return LAUNCH_CONTRACTS[chainKey as keyof typeof LAUNCH_CONTRACTS];
}

export function isConfigured(c: LaunchContracts | undefined): c is LaunchContracts {
  return Boolean(c && c.factory !== ZERO && c.manager !== ZERO && c.locker !== ZERO && c.v2Router !== ZERO);
}
