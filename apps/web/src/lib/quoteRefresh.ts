import { resetAdaUsd } from "./adaDex.ts";
import { cacheInvalidate } from "./defi/cache.ts";
import { resetNearWrapUsd } from "./nearDex.ts";

/** Drop RAM quote entries so the next holdings wave cannot cache-hit. Does not touch balances. */
export function invalidateHoldingsQuotes() {
  cacheInvalidate("v1:quote");
  cacheInvalidate("v1:http.jup");
  cacheInvalidate("v1:http.minswap");
  resetAdaUsd();
  resetNearWrapUsd();
}
