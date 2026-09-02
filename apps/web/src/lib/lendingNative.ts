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
  core?: boolean;
  extra?: boolean;
}): Promise<LendCard[]> {
  const core = opts.core !== false;
  const extra = opts.extra !== false;
  const tag = [opts.sol, opts.sui, opts.tron, opts.aptos, core ? "c" : "", extra ? "x" : ""].filter(Boolean).join("|") || "none";
  return accountCache("pos.lend", "native", tag, "bundle", () => readNativeLendingUncached({ ...opts, core, extra }));
}

async function readNativeLendingUncached(opts: {
  sol?: string;
  sui?: string;
  tron?: string;
  aptos?: string;
  quotes: Map<string, Quote>;
  core: boolean;
  extra: boolean;
}): Promise<LendCard[]> {
  const jobs: Array<Promise<LendCard | null>> = [];
  if (opts.sol && opts.core) {
    jobs.push(readKamino(opts.sol, opts.quotes));
    jobs.push(readJupiterLend(opts.sol, opts.quotes));
  }
  if (opts.sui) {
    if (opts.core) {
      jobs.push(readNavi(opts.sui));
      jobs.push(readSuilend(opts.sui));
    }
    if (opts.extra) jobs.push(readScallop(opts.sui));
  }
  if (opts.tron && opts.extra) jobs.push(readJustLend(opts.tron));
  if (opts.aptos && opts.extra) jobs.push(readEchelon(opts.aptos));
  if (!jobs.length) return [];
  const rows = await Promise.all(jobs);
  return rows.filter((c): c is LendCard => Boolean(c));
}
