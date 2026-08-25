import { CHAINS, ChainKey, type ChainKeyName } from "@ysk-mint/config";
import { ErrorCode, type LaunchError } from "../errors/codes";
import { err } from "../errors/decode";
import type { Locale } from "../errors/messages";
import { validateBasics, validateModuleFlags, validateSupplyMode } from "./token";

export type LaunchDraft = {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  supplyMode: number;
  moduleFlags: number;
  owner: `0x${string}`;
  chains: number[];
};

export function validateChainKey(chain: number, locale: Locale = "en"): LaunchError[] {
  const max = Math.max(...Object.values(ChainKey));
  if (!Number.isInteger(chain) || chain < 0 || chain > max) {
    return [err(ErrorCode.InvalidChainKey, [chain], locale)];
  }
  return [];
}

export function validateChainEnabled(chain: number, locale: Locale = "en"): LaunchError[] {
  const def = CHAINS[chain as (typeof ChainKey)[ChainKeyName]];
  if (!def) return [err(ErrorCode.InvalidChainKey, [chain], locale)];
  if (!def.enabled || !def.evm) return [err(ErrorCode.ChainDisabled, [chain], locale)];
  return [];
}

export function validateLaunchDraft(draft: LaunchDraft, locale: Locale = "en"): LaunchError[] {
  const errors: LaunchError[] = [
    ...validateBasics(draft, locale),
    ...validateSupplyMode(draft.supplyMode, locale),
    ...validateModuleFlags(draft.moduleFlags, locale),
  ];
  if (!draft.owner || draft.owner === "0x0000000000000000000000000000000000000000") {
    errors.push(err(ErrorCode.RecipientZero, [], locale));
  }
  if (draft.chains.length === 0) errors.push(err(ErrorCode.InvalidChainKey, [], locale));
  for (const c of draft.chains) errors.push(...validateChainEnabled(c, locale));
  return errors;
}
