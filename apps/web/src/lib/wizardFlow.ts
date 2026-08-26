import { LaunchStep, type ChainVm } from "@ysk-mint/config";
import { selectedChains } from "./launchTargets.ts";

/** UI order. Do not reorder Solidity LaunchStep enum values. */
export const STEP_FLOW = [
  LaunchStep.Wallet,
  LaunchStep.Chains,
  LaunchStep.Basics,
  LaunchStep.Tokenomics,
  LaunchStep.Liquidity,
  LaunchStep.Omnichain,
  LaunchStep.Review,
  LaunchStep.Execute,
  LaunchStep.Success,
] as const;

export function flowIndex(step: number) {
  const i = STEP_FLOW.indexOf(step as (typeof STEP_FLOW)[number]);
  return i < 0 ? 0 : i;
}

export function nextFlowStep(step: number) {
  const i = flowIndex(step);
  return STEP_FLOW[Math.min(i + 1, STEP_FLOW.length - 1)]!;
}

export function prevFlowStep(step: number) {
  const i = flowIndex(step);
  return STEP_FLOW[Math.max(i - 1, 0)]!;
}

export function selectedVms(keys: number[]): ChainVm[] {
  const set = new Set<ChainVm>();
  for (const c of selectedChains(keys)) set.add(c.vm);
  return [...set];
}

export function hasEvm(keys: number[]) {
  return selectedVms(keys).includes("evm");
}

export function decimalsOptions(keys: number[]): number[] {
  const vms = selectedVms(keys);
  if (vms.includes("evm")) return [6, 8, 9, 18];
  const out = new Set<number>();
  if (vms.includes("cardano")) [0, 2, 4, 6].forEach((d) => out.add(d));
  if (vms.includes("solana") || vms.includes("sui") || vms.includes("ton")) [6, 9].forEach((d) => out.add(d));
  if (vms.includes("near")) [8, 18, 24].forEach((d) => out.add(d));
  if (vms.includes("aptos")) [6, 8].forEach((d) => out.add(d));
  if (!out.size) return [6, 8, 9, 18];
  return [...out].sort((a, b) => a - b);
}

export function defaultDecimals(keys: number[]) {
  const vms = selectedVms(keys);
  if (vms.includes("evm")) return 18;
  if ((vms.includes("solana") || vms.includes("sui") || vms.includes("ton")) && vms.length === 1) return 9;
  if (vms.includes("near") && vms.length === 1) return 18;
  if (vms.includes("cardano") && vms.length === 1) return 6;
  if (vms.includes("aptos") && vms.length === 1) return 8;
  return decimalsOptions(keys)[0] ?? 18;
}
