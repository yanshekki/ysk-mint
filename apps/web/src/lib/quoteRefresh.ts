import { useSyncExternalStore } from "react";
import { resetAdaUsd } from "./adaDex.ts";
import { cacheDropAccountRam, cacheInvalidate } from "./defi/cache.ts";
import { resetNearWrapUsd } from "./nearDex.ts";

let holdingsEpoch = 0;
const holdingsListeners = new Set<() => void>();

function emitHoldingsEpoch() {
  holdingsEpoch += 1;
  for (const fn of holdingsListeners) fn();
}

export function useHoldingsRefreshEpoch() {
  return useSyncExternalStore(
    (onChange) => {
      holdingsListeners.add(onChange);
      return () => holdingsListeners.delete(onChange);
    },
    () => holdingsEpoch,
    () => 0,
  );
}

/** Drop RAM quote entries so the next holdings wave cannot cache-hit. */
export function invalidateHoldingsQuotes() {
  cacheInvalidate("v1:quote");
  cacheInvalidate("v1:http.jup");
  cacheInvalidate("v1:http.minswap");
  cacheInvalidate("v1:http.ref");
  resetAdaUsd();
  resetNearWrapUsd();
}

/** Quotes plus wallet, stake, lend, and LP balances. */
export function invalidateHoldingsRefresh() {
  invalidateHoldingsQuotes();
  for (const prefix of ["v1:pos.", "v1:hold.", "v1:http.near", "v1:http.koios", "v1:http.yoroi", "v1:idx."]) {
    cacheInvalidate(prefix);
  }
  cacheDropAccountRam();
  emitHoldingsEpoch();
}
