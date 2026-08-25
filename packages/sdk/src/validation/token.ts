import {
  DECIMALS_MAX,
  DECIMALS_MIN,
  MODULE_ALL_MASK,
  NAME_MAX_BYTES,
  NAME_MIN_BYTES,
  SYMBOL_MAX_BYTES,
  SYMBOL_MIN_BYTES,
  MAX_SUPPLY,
  SupplyMode,
  TAX_MAX_BPS_ONE_SIDE,
  TAX_MAX_BPS_SUM,
} from "@ysk-mint/config";
import { ErrorCode, type LaunchError } from "../errors/codes";
import { err } from "../errors/decode";
import type { Locale } from "../errors/messages";

const encoder = new TextEncoder();

export function utf8Bytes(value: string): number {
  return encoder.encode(value).length;
}

export function validateName(name: string, locale: Locale = "en"): LaunchError[] {
  const errors: LaunchError[] = [];
  const bytes = utf8Bytes(name);
  if (bytes < NAME_MIN_BYTES || bytes > NAME_MAX_BYTES) errors.push(err(ErrorCode.InvalidName, [], locale));
  else if (name.trim().length === 0) errors.push(err(ErrorCode.InvalidName, [], locale));
  return errors;
}

export function validateSymbol(symbol: string, locale: Locale = "en"): LaunchError[] {
  const errors: LaunchError[] = [];
  const bytes = utf8Bytes(symbol);
  if (bytes < SYMBOL_MIN_BYTES || bytes > SYMBOL_MAX_BYTES) {
    errors.push(err(ErrorCode.InvalidSymbol, [], locale));
    return errors;
  }
  if (!/^[A-Za-z0-9]+$/.test(symbol)) errors.push(err(ErrorCode.InvalidSymbol, [], locale));
  return errors;
}

export function validateDecimals(decimals: number, locale: Locale = "en"): LaunchError[] {
  if (!Number.isInteger(decimals) || decimals < DECIMALS_MIN || decimals > DECIMALS_MAX) {
    return [err(ErrorCode.DecimalsOutOfRange, [decimals], locale)];
  }
  return [];
}

export function validateSupply(supply: bigint, locale: Locale = "en"): LaunchError[] {
  if (supply === 0n) return [err(ErrorCode.SupplyZero, [], locale)];
  if (supply > MAX_SUPPLY) return [err(ErrorCode.SupplyOverflow, [supply], locale)];
  return [];
}

export function validateSupplyMode(mode: number, locale: Locale = "en"): LaunchError[] {
  if (mode !== SupplyMode.Fixed && mode !== SupplyMode.Mintable) {
    return [err(ErrorCode.InvalidSupplyMode, [mode], locale)];
  }
  return [];
}

export function validateModuleFlags(flags: number, locale: Locale = "en"): LaunchError[] {
  if ((flags & ~MODULE_ALL_MASK) !== 0) return [err(ErrorCode.UnknownModule, [flags], locale)];
  return [];
}

export function validateTax(
  buyBps: number,
  sellBps: number,
  recipient: `0x${string}` | string,
  locale: Locale = "en",
): LaunchError[] {
  const errors: LaunchError[] = [];
  if (buyBps > TAX_MAX_BPS_ONE_SIDE) errors.push(err(ErrorCode.TaxTooHigh, [buyBps], locale));
  if (sellBps > TAX_MAX_BPS_ONE_SIDE) errors.push(err(ErrorCode.TaxTooHigh, [sellBps], locale));
  if (buyBps + sellBps > TAX_MAX_BPS_SUM) errors.push(err(ErrorCode.TaxTooHigh, [buyBps + sellBps], locale));
  if ((buyBps > 0 || sellBps > 0) && (!recipient || recipient === "0x0000000000000000000000000000000000000000")) {
    errors.push(err(ErrorCode.RecipientZero, [], locale));
  }
  return errors;
}

export function validateBasics(
  input: { name: string; symbol: string; decimals: number; totalSupply: bigint },
  locale: Locale = "en",
): LaunchError[] {
  return [
    ...validateName(input.name, locale),
    ...validateSymbol(input.symbol, locale),
    ...validateDecimals(input.decimals, locale),
    ...validateSupply(input.totalSupply, locale),
  ];
}
