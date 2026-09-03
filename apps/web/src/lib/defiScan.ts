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

function sameNum(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const s = new Set(b);
  return a.every((id) => s.has(id));
}

export function chainPresetOf(disabled: readonly number[]): ScanPreset | null {
  const main = new Set(scanMainnets().map((c) => c.chainId));
  const d = disabled.filter((id) => main.has(id));
  for (const p of ["core", "extra", "all", "none"] as const) {
    if (sameNum(d, disabledForChainPreset(p))) return p;
  }
  return null;
}

export function defiPresetOf(disabled: readonly string[]): ScanPreset | null {
  const d = disabled.filter((k) => (DEFI_SCAN_KINDS as readonly string[]).includes(k));
  for (const p of ["core", "extra", "all", "none"] as const) {
    const want = disabledForDefiPreset(p);
    if (d.length === want.length && want.every((k) => d.includes(k))) return p;
  }
  return null;
}

export function isCoreChainId(chainId: number) {
  return scanCoreIds().has(chainId);
}
