import { LOCK_MAX_SECONDS, LOCK_MIN_SECONDS, LockMode } from "@ysk-mint/config";
import { ErrorCode, type LaunchError } from "../errors/codes.js";
import { err } from "../errors/decode.js";
import type { Locale } from "../errors/messages.js";

export function validateLockMode(mode: number, locale: Locale = "en"): LaunchError[] {
  if (mode !== LockMode.Timed && mode !== LockMode.Burn) {
    return [err(ErrorCode.InvalidLockMode, [mode], locale)];
  }
  return [];
}

export function validateLock(mode: number, duration: number, locale: Locale = "en"): LaunchError[] {
  const errors = validateLockMode(mode, locale);
  if (errors.length) return errors;
  if (mode === LockMode.Burn) return [];
  if (!Number.isInteger(duration) || duration < LOCK_MIN_SECONDS || duration > LOCK_MAX_SECONDS) {
    return [err(ErrorCode.LockDurationInvalid, [duration], locale)];
  }
  return [];
}

export function validateLpAmounts(tokenAmount: bigint, nativeAmount: bigint, locale: Locale = "en"): LaunchError[] {
  const errors: LaunchError[] = [];
  if (tokenAmount === 0n) errors.push(err(ErrorCode.ZeroAmount, ["token"], locale));
  if (nativeAmount === 0n) errors.push(err(ErrorCode.ZeroAmount, ["native"], locale));
  return errors;
}
