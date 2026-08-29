import type { LendMarketRow } from "./lendMarkets.ts";
import { echelon } from "./lendHttp/aptos.ts";
import { curveLend, lista } from "./lendHttp/curve.ts";
import { burrow } from "./lendHttp/near.ts";
import { kamino, jupiterLend, saveLend } from "./lendHttp/sol.ts";
import { navi, scallop, suilend } from "./lendHttp/sui.ts";
import { justlend } from "./lendHttp/tron.ts";
import { CURVE_LEND_CHAIN } from "./lendHttp/shared.ts";

export { HTTP_LEND_CHAINS, CURVE_LEND_CHAINS } from "./lendHttp/shared.ts";
export { readDolomiteMarkets, readFraxlendMarkets } from "./lendHttp/evm.ts";

export async function loadHttpLendMarkets(chainId: number): Promise<LendMarketRow[]> {
  const jobs: Array<Promise<LendMarketRow[]>> = [];
  if (chainId === 101) {
    jobs.push(kamino().catch(() => []));
    jobs.push(jupiterLend().catch(() => []));
    jobs.push(saveLend().catch(() => []));
  }
  if (chainId === 397) jobs.push(burrow().catch(() => []));
  if (chainId === 784) {
    jobs.push(navi().catch(() => []));
    jobs.push(scallop().catch(() => []));
    jobs.push(suilend().catch(() => []));
  }
  if (chainId === 728126428) jobs.push(justlend().catch(() => []));
  if (chainId === 56) jobs.push(lista().catch(() => []));
  if (chainId === 637) jobs.push(echelon().catch(() => []));
  if (CURVE_LEND_CHAIN[chainId]) jobs.push(curveLend(chainId).catch(() => []));
  if (!jobs.length) return [];
  const parts = await Promise.all(jobs);
  return parts.flat();
}
