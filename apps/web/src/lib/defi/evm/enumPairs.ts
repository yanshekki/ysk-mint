import { formatUnits, type Address, type PublicClient } from "viem";
import { CHAINS } from "@ysk-mint/config";
import { DEX, isUsdStableAddress } from "../../defiAddresses.ts";
import { pairId } from "../../pairKey.ts";
import type { Venue } from "../../dexVenues.ts";
import { forChunks } from "../cache.ts";
import type { DefiCtx, MarketRow, VenueQuote } from "../types.ts";
import { chainTokenIcon, marketTokensOn, type MarketToken } from "../universe.ts";
import { aeroFactoryAbi, erc20MetaAbi, v2FactoryAbi, v2PairAbi } from "./abis.ts";
import { ZERO } from "./math.ts";

/** Full factory walks on huge Uni V2 clones would scan junk. Small venues stay complete. */
export const MAX_ENUM_POOLS = 800;

type ListFn = "allPairs" | "allPools";

async function factoryList(client: PublicClient, factory: Address, aero: boolean): Promise<{ fn: ListFn; n: number } | null> {
  if (aero) {
    try {
      const n = Number(await client.readContract({ address: factory, abi: aeroFactoryAbi, functionName: "allPoolsLength" }));
      if (Number.isFinite(n) && n >= 0) return { fn: "allPools", n };
    } catch {
      /* Solidly forks expose allPairsLength instead. */
    }
    try {
      const n = Number(await client.readContract({ address: factory, abi: aeroFactoryAbi, functionName: "allPairsLength" }));
      if (Number.isFinite(n) && n >= 0) return { fn: "allPairs", n };
    } catch {
      /* fall through */
    }
  }
  try {
    const n = Number(await client.readContract({ address: factory, abi: v2FactoryAbi, functionName: "allPairsLength" }));
    if (Number.isFinite(n) && n >= 0) return { fn: "allPairs", n };
  } catch {
    return null;
  }
  return null;
}

async function listPools(client: PublicClient, factory: Address, fn: ListFn, n: number): Promise<Address[]> {
  const out: Address[] = [];
  const idxs = Array.from({ length: n }, (_, i) => i);
  await forChunks(idxs, 80, async (chunk) => {
    try {
      const res = await client.multicall({
        contracts: chunk.map((i) =>
          fn === "allPools"
            ? { address: factory, abi: aeroFactoryAbi, functionName: "allPools" as const, args: [BigInt(i)] }
            : { address: factory, abi: v2FactoryAbi, functionName: "allPairs" as const, args: [BigInt(i)] },
        ),
        allowFailure: true,
      });
      res.forEach((r) => {
        if (r.status !== "success") return;
        const pool = r.result as Address;
        if (pool && pool !== ZERO) out.push(pool);
      });
    } catch {
      /* batch miss */
    }
  });
  return out;
}

async function loadMetas(client: PublicClient, chainId: number, addrs: Address[]): Promise<Map<string, MarketToken>> {
  const map = new Map(marketTokensOn(chainId).map((t) => [t.address.toLowerCase(), t]));
  const missing: Address[] = [];
  const seen = new Set<string>();
  for (const a of addrs) {
    const k = a.toLowerCase();
    if (!k || map.has(k) || seen.has(k)) continue;
    seen.add(k);
    missing.push(a);
  }
  const icon = chainTokenIcon(chainId);
  await forChunks(missing, 40, async (chunk) => {
    try {
      const res = await client.multicall({
        contracts: chunk.flatMap((a) => [
          { address: a, abi: erc20MetaAbi, functionName: "decimals" as const },
          { address: a, abi: erc20MetaAbi, functionName: "symbol" as const },
        ]),
        allowFailure: true,
      });
      chunk.forEach((a, i) => {
        const dec = res[i * 2];
        const sym = res[i * 2 + 1];
        const decimals = dec.status === "success" && typeof dec.result === "number" ? dec.result : 18;
        const raw = sym.status === "success" ? String(sym.result ?? "") : "";
        const symbol = raw.trim() ? raw.trim().slice(0, 16) : a.slice(0, 6);
        map.set(a.toLowerCase(), { chainId, address: a, decimals, symbol, icon });
      });
    } catch {
      chunk.forEach((a) => {
        if (!map.has(a.toLowerCase())) {
          map.set(a.toLowerCase(), { chainId, address: a, decimals: 18, symbol: a.slice(0, 6), icon });
        }
      });
    }
  });
  return map;
}

type RawPair = { pool: Address; token0: Address; token1: Address; r0: bigint; r1: bigint; stable: boolean };

async function readPairs(client: PublicClient, pools: Address[]): Promise<RawPair[]> {
  const out: RawPair[] = [];
  await forChunks(pools, 20, async (chunk) => {
    try {
      const res = await client.multicall({
        contracts: chunk.flatMap((pool) => [
          { address: pool, abi: v2PairAbi, functionName: "token0" as const },
          { address: pool, abi: v2PairAbi, functionName: "token1" as const },
          { address: pool, abi: v2PairAbi, functionName: "getReserves" as const },
          { address: pool, abi: v2PairAbi, functionName: "stable" as const },
        ]),
        allowFailure: true,
      });
      chunk.forEach((pool, i) => {
        const t0 = res[i * 4];
        const t1 = res[i * 4 + 1];
        const rs = res[i * 4 + 2];
        const st = res[i * 4 + 3];
        if (t0.status !== "success" || t1.status !== "success" || rs.status !== "success") return;
        const token0 = t0.result as Address;
        const token1 = t1.result as Address;
        if (!token0 || !token1 || token0 === ZERO || token1 === ZERO || token0.toLowerCase() === token1.toLowerCase()) return;
        const reserves = rs.result as readonly [bigint, bigint, number];
        const r0 = reserves[0];
        const r1 = reserves[1];
        if (r0 === 0n && r1 === 0n) return;
        out.push({
          pool,
          token0,
          token1,
          r0,
          r1,
          stable: st.status === "success" ? Boolean(st.result) : false,
        });
      });
    } catch {
      /* batch miss */
    }
  });
  return out;
}

function isQuote(chainId: number, address: string) {
  const d = DEX[chainId];
  if (!d) return false;
  return isUsdStableAddress(d, address) || address.toLowerCase() === d.wrapped.toLowerCase();
}

export async function enumVenueMarkets(ctx: DefiCtx, venue: Venue, kind: "v2" | "aero"): Promise<MarketRow[]> {
  const client = ctx.evm;
  if (!client) return [];
  const factory = venue.factory as Address;
  const listed = await factoryList(client, factory, kind === "aero");
  if (!listed || listed.n <= 0 || listed.n > MAX_ENUM_POOLS) return [];
  const pools = await listPools(client, factory, listed.fn, listed.n);
  if (!pools.length) return [];
  const raw = await readPairs(client, pools);
  if (!raw.length) return [];
  const metas = await loadMetas(
    client,
    venue.chainId,
    raw.flatMap((p) => [p.token0, p.token1]),
  );
  const chain = Object.values(CHAINS).find((c) => c.chainId === venue.chainId);
  const chainShort = chain?.short ?? String(venue.chainId);
  const byPair = new Map<string, MarketRow>();
  for (const p of raw) {
    const m0 = metas.get(p.token0.toLowerCase());
    const m1 = metas.get(p.token1.toLowerCase());
    if (!m0 || !m1) continue;
    const r0 = Number(formatUnits(p.r0, m0.decimals));
    const r1 = Number(formatUnits(p.r1, m1.decimals));
    if (!Number.isFinite(r0) || !Number.isFinite(r1) || (!(r0 > 0) && !(r1 > 0))) continue;
    const quote0 = isQuote(venue.chainId, m0.address);
    const quote1 = isQuote(venue.chainId, m1.address);
    let a = m0;
    let b = m1;
    let reserveA = r0;
    let reserveB = r1;
    if (quote0 && !quote1) {
      a = m1;
      b = m0;
      reserveA = r1;
      reserveB = r0;
    }
    const priceAinB = reserveA > 0 && reserveB > 0 ? reserveB / reserveA : 0;
    if (!Number.isFinite(priceAinB)) continue;
    const quote = isQuote(venue.chainId, b.address);
    const tvlQuote = quote && reserveB > 0 ? reserveB * 2 : 0;
    const feeLabel = kind === "aero" ? (p.stable ? "0.05%" : "0.30%") : "0.30%";
    const v: VenueQuote = {
      protocolId: venue.id,
      protocolName: venue.name,
      chainId: venue.chainId,
      pool: p.pool,
      feeLabel,
      priceAinB,
      reserveA,
      reserveB,
      tvlQuote,
      kind,
    };
    const id = pairId(venue.chainId, a.address, b.address);
    const prev = byPair.get(id);
    if (prev) {
      if (!prev.venues.some((x) => x.pool.toLowerCase() === p.pool.toLowerCase())) prev.venues.push(v);
      prev.depth += tvlQuote;
      if (!prev.venueNames.includes(venue.name)) prev.venueNames.push(venue.name);
      continue;
    }
    byPair.set(id, {
      pairId: id,
      chainId: venue.chainId,
      chainShort,
      symbolA: a.symbol ?? a.address.slice(0, 6),
      symbolB: b.symbol ?? b.address.slice(0, 6),
      iconA: a.icon ?? chainTokenIcon(venue.chainId),
      iconB: b.icon ?? chainTokenIcon(venue.chainId),
      tokenA: a.address,
      tokenB: b.address,
      venues: [v],
      price: quote && priceAinB ? priceAinB : null,
      depth: tvlQuote,
      venueNames: [venue.name],
    });
  }
  return [...byPair.values()];
}
