/** 2^96 is exact in IEEE-754. */
const Q96 = 2 ** 96;

/** Human quote-per-base from Uniswap V3 sqrtPriceX96. Uses float √P/2^96, not bigint √P². */
export function priceFromSqrtPriceX96(
  sqrtPriceX96: bigint,
  token0IsBase: boolean,
  baseDecimals: number,
  quoteDecimals: number,
) {
  if (sqrtPriceX96 === 0n) return null;
  const ratio = Number(sqrtPriceX96) / Q96;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  const dec0 = token0IsBase ? baseDecimals : quoteDecimals;
  const dec1 = token0IsBase ? quoteDecimals : baseDecimals;
  const t1PerT0 = ratio * ratio * 10 ** (dec0 - dec1);
  if (!Number.isFinite(t1PerT0) || t1PerT0 <= 0) return null;
  const price = token0IsBase ? t1PerT0 : 1 / t1PerT0;
  return Number.isFinite(price) && price > 0 ? price : null;
}

export const ZERO = "0x0000000000000000000000000000000000000000";
