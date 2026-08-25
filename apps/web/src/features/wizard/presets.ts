export const DECIMALS = [6, 8, 9, 18] as const;

export const SUPPLY_PRESETS = [
  { value: "1000000", label: "1M" },
  { value: "10000000", label: "10M" },
  { value: "100000000", label: "100M" },
  { value: "1000000000", label: "1B" },
  { value: "10000000000", label: "10B" },
] as const;

export const LP_BPS = [
  { value: 5000, label: "50%" },
  { value: 7000, label: "70%" },
  { value: 8000, label: "80%" },
  { value: 9000, label: "90%" },
  { value: 9900, label: "99%" },
] as const;

export const NATIVE_PRESETS = ["0.05", "0.1", "0.25", "0.5", "1", "2"] as const;

export const TAX_BPS = [
  { value: 0, label: "0%" },
  { value: 100, label: "1%" },
  { value: 200, label: "2%" },
  { value: 300, label: "3%" },
  { value: 500, label: "5%" },
] as const;

export const WALLET_BPS = [
  { value: 100, label: "1%" },
  { value: 200, label: "2%" },
  { value: 500, label: "5%" },
  { value: 1000, label: "10%" },
] as const;

export const LOCK_CARDS = [
  { mode: 1, duration: 0, titleKey: "burn", hintKey: "burnHint" },
  { mode: 0, duration: 30 * 86400, titleKey: "d30", hintKey: "timedHint" },
  { mode: 0, duration: 90 * 86400, titleKey: "d90", hintKey: "timedHint" },
  { mode: 0, duration: 180 * 86400, titleKey: "d180", hintKey: "timedHint" },
  { mode: 0, duration: 365 * 86400, titleKey: "d365", hintKey: "timedHint" },
] as const;

export function lpTokenAmount(totalSupply: string, bps: number): string {
  try {
    return ((BigInt(totalSupply) * BigInt(bps)) / 10000n).toString();
  } catch {
    return "0";
  }
}
