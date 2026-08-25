/** Must match LaunchValidation.sol */
export const NAME_MIN_BYTES = 1;
export const NAME_MAX_BYTES = 32;
export const SYMBOL_MIN_BYTES = 1;
export const SYMBOL_MAX_BYTES = 11;
export const DECIMALS_MIN = 6;
export const DECIMALS_MAX = 18;
export const MAX_SUPPLY = (1n << 128n) - 1n;
export const TAX_MAX_BPS_ONE_SIDE = 1000;
export const TAX_MAX_BPS_SUM = 1500;
export const LOCK_MIN_SECONDS = 30 * 24 * 60 * 60;
export const LOCK_MAX_SECONDS = 5 * 365 * 24 * 60 * 60;
export const LP_TOKEN_MAX_BPS = 9900;
export const PLATFORM_FEE_MAX_BPS = 500;
export const DEFAULT_DECIMALS = 18;
