import { coreHoldingsChains, featuredChains } from "@ysk-mint/config";

export const DEFI_SCAN_KINDS = ["lendCore", "lendExtra", "lpCore", "lpExtra", "stakeCore", "stakeExtra"] as const;
export type DefiScanKind = (typeof DEFI_SCAN_KINDS)[number];

export const DEFI_CORE_KINDS: DefiScanKind[] = ["lendCore", "lpCore", "stakeCore"];
export const DEFI_EXTRA_KINDS: DefiScanKind[] = ["lendExtra", "lpExtra", "stakeExtra"];

export type ScanPreset = "core" | "extra" | "all" | "none";

export function scanMainnets() {
  return featuredChains().filter((c) => !c.testnet);
}

export function scanCoreIds() {
  return new Set(coreHoldingsChains().filter((c) => !c.testnet).map((c) => c.chainId));
}

export function disabledForChainPreset(preset: ScanPreset): number[] {
  const all = scanMainnets();
  const core = scanCoreIds();
  if (preset === "all") return [];
  if (preset === "none") return all.map((c) => c.chainId);
  if (preset === "core") return all.filter((c) => !core.has(c.chainId)).map((c) => c.chainId);
  return all.filter((c) => core.has(c.chainId)).map((c) => c.chainId);
}

export function disabledForDefiPreset(preset: ScanPreset): DefiScanKind[] {
  if (preset === "all") return [];
  if (preset === "none") return [...DEFI_SCAN_KINDS];
  if (preset === "core") return [...DEFI_EXTRA_KINDS];
  return [...DEFI_CORE_KINDS];
}

export function isDefiEnabled(kind: DefiScanKind, disabled: readonly string[]) {
  return !disabled.includes(kind);
}

export function isCoreChainId(chainId: number) {
  return scanCoreIds().has(chainId);
}
