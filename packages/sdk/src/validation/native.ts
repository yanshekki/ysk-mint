import { ErrorCode, type LaunchError } from "../errors/codes";
import { err } from "../errors/decode";
import type { Locale } from "../errors/messages";

const NEAR_ACCOUNT =
  /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export function isNearAccountId(id: string): boolean {
  return id.length > 1 && id.length <= 64 && NEAR_ACCOUNT.test(id);
}

export function isCardanoAddress(addr: string): boolean {
  return /^(addr1|addr_test1|stake1|stake_test1)[0-9a-z]+$/.test(addr) || /^[0-9a-f]{16,}$/i.test(addr);
}

export function validateNearAccount(id: string, locale: Locale = "en"): LaunchError[] {
  if (!isNearAccountId(id)) return [err(ErrorCode.RecipientZero, [], locale)];
  return [];
}

export function validateCardanoAddress(addr: string, locale: Locale = "en"): LaunchError[] {
  if (!isCardanoAddress(addr)) return [err(ErrorCode.RecipientZero, [], locale)];
  return [];
}
