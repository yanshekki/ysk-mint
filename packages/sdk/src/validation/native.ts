import { ErrorCode, type LaunchError } from "../errors/codes.js";
import { err } from "../errors/decode.js";
import type { Locale } from "../errors/messages.js";

const NEAR_ACCOUNT =
  /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export function isNearAccountId(id: string): boolean {
  return id.length > 1 && id.length <= 64 && NEAR_ACCOUNT.test(id);
}

export function isCardanoAddress(addr: string): boolean {
  return /^(addr1|addr_test1|stake1|stake_test1)[0-9a-z]+$/.test(addr) || /^[0-9a-f]{16,}$/i.test(addr);
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Solana pubkey: base58 of 32 bytes. */
export function isSolanaAddress(addr: string): boolean {
  if (addr.length < 32 || addr.length > 44) return false;
  const bytes: number[] = [];
  for (const ch of addr) {
    const val = B58.indexOf(ch);
    if (val < 0) return false;
    let carry = val;
    for (let i = 0; i < bytes.length; i++) {
      const x = bytes[i]! * 58 + carry;
      bytes[i] = x & 0xff;
      carry = x >> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const ch of addr) {
    if (ch !== "1") break;
    bytes.push(0);
  }
  return bytes.length === 32;
}

export function validateNearAccount(id: string, locale: Locale = "en"): LaunchError[] {
  if (!isNearAccountId(id)) return [err(ErrorCode.RecipientZero, [], locale)];
  return [];
}

export function validateCardanoAddress(addr: string, locale: Locale = "en"): LaunchError[] {
  if (!isCardanoAddress(addr)) return [err(ErrorCode.RecipientZero, [], locale)];
  return [];
}

export function validateSolanaAddress(addr: string, locale: Locale = "en"): LaunchError[] {
  if (!isSolanaAddress(addr)) return [err(ErrorCode.RecipientZero, [], locale)];
  return [];
}
