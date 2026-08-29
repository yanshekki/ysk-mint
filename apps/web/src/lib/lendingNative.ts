import { accountCache } from "./defi/cache.ts";
import type { Quote } from "./defiQuotes.ts";
import type { LendCard } from "./lendingExtra.ts";
import { readEchelon } from "./lendNative/echelon.ts";
import { readJupiterLend } from "./lendNative/jupiter.ts";
import { readJustLend } from "./lendNative/justlend.ts";
import { readKamino } from "./lendNative/kamino.ts";
import { readNavi } from "./lendNative/navi.ts";
import { readScallop } from "./lendNative/scallop.ts";
import { readSuilend } from "./lendNative/suilend.ts";

export { readEchelon } from "./lendNative/echelon.ts";
export { readJupiterLend } from "./lendNative/jupiter.ts";
export { readJustLend } from "./lendNative/justlend.ts";
export { readKamino } from "./lendNative/kamino.ts";
export { readNavi } from "./lendNative/navi.ts";
export { readScallop } from "./lendNative/scallop.ts";
export { readSuilend } from "./lendNative/suilend.ts";

export async function readNativeLending(opts: {
  sol?: string;
  sui?: string;
  tron?: string;
  aptos?: string;
  quotes: Map<string, Quote>;
}): Promise<LendCard[]> {
  const tag = [opts.sol, opts.sui, opts.tron, opts.aptos].filter(Boolean).join("|") || "none";
  return accountCache("pos.lend", "native", tag, "bundle", () => readNativeLendingUncached(opts));
}

async function readNativeLendingUncached(opts: {
  sol?: string;
  sui?: string;
  tron?: string;
  aptos?: string;
  quotes: Map<string, Quote>;
}): Promise<LendCard[]> {
  const jobs: Array<Promise<LendCard | null>> = [];
  if (opts.sol) {
    jobs.push(readKamino(opts.sol, opts.quotes));
    jobs.push(readJupiterLend(opts.sol, opts.quotes));
  }
  if (opts.sui) {
    jobs.push(readNavi(opts.sui));
    jobs.push(readSuilend(opts.sui));
    jobs.push(readScallop(opts.sui));
  }
  if (opts.tron) jobs.push(readJustLend(opts.tron));
  if (opts.aptos) jobs.push(readEchelon(opts.aptos));
  const rows = await Promise.all(jobs);
  return rows.filter((c): c is LendCard => Boolean(c));
}
