import { CHAINS, ChainKey, type ChainKeyName } from "@ysk-mint/config";
import { ErrorCode, type LaunchError } from "../errors/codes.js";
import { err } from "../errors/decode.js";
import type { Locale } from "../errors/messages.js";
import { validateBasics, validateModuleFlags, validateSupplyMode } from "./token.js";

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
  if (!def.enabled) return [err(ErrorCode.ChainDisabled, [chain], locale)];
  return [];
}

export function validateLaunchDraft(draft: LaunchDraft, locale: Locale = "en"): LaunchError[] {
  const errors: LaunchError[] = [
    ...validateBasics(draft, locale),
    ...validateSupplyMode(draft.supplyMode, locale),
    ...validateModuleFlags(draft.moduleFlags, locale),
  ];
  if (draft.chains.length === 0) errors.push(err(ErrorCode.InvalidChainKey, [], locale));
  for (const c of draft.chains) errors.push(...validateChainEnabled(c, locale));
  const needsEvmOwner = draft.chains.some((c) => CHAINS[c as (typeof ChainKey)[ChainKeyName]]?.evm);
  if (
    needsEvmOwner &&
    (!draft.owner || draft.owner === "0x0000000000000000000000000000000000000000")
  ) {
    errors.push(err(ErrorCode.RecipientZero, [], locale));
  }
  return errors;
}
