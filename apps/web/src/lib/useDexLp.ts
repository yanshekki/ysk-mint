import { useEffect, useState } from "react";
import { type Address, type PublicClient } from "viem";
import { getPublicClient } from "wagmi/actions";
import { useConfig } from "wagmi";
import { venuesOn, SEED_PAIRS } from "./dexVenues.ts";
import { v2FactoryAbi, aeroFactoryAbi, erc20BalAbi, readVenuesForPair, weightedPrice } from "./dexPools.ts";
import { discoveredPools, loadEvmMarkets } from "./defi/markets.ts";
import { marketTokensOn } from "./defi/universe.ts";
import { mapChunk } from "./defi/cache.ts";
import { trackLive, useLiveStatus } from "./liveStatus.ts";
import { pairId, canonAddr, type Addr } from "./pairKey.ts";
import { nearMyLp } from "./nearDex.ts";
import { adaMyLp } from "./adaDex.ts";

const ZERO = "0x0000000000000000000000000000000000000000";

const npmAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "tokenOfOwnerByIndex", stateMutability: "view", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "nonce", type: "uint96" },
      { name: "operator", type: "address" },
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "liquidity", type: "uint128" },
    ],
  },
] as const;

export type MyLpRow = {
  pairId: string;
  chainId: number;
  symbolA: string;
  symbolB: string;
  tokenA: string;
  tokenB: string;
  iconA: string;
  iconB: string;
  venueCount: number;
  venueNames: string[];
  valueHint: string;
};

function seedMeta(chainId: number, token: string) {
  const a = token.toLowerCase();
  for (const p of SEED_PAIRS) {
    if (p.chainId !== chainId) continue;
    if (p.a.address.toLowerCase() === a) return p.a;
    if (p.b.address.toLowerCase() === a) return p.b;
  }
  const hit = marketTokensOn(chainId).find((t) => t.address.toLowerCase() === a);
  if (hit) return { address: hit.address as Addr, symbol: hit.symbol ?? hit.address.slice(0, 6), decimals: hit.decimals, icon: hit.icon };
  return undefined;
}

async function v2Positions(client: PublicClient, chainId: number, user: Address) {
  const found: Array<{ a: Addr; b: Addr }> = [];
  await loadEvmMarkets(chainId).catch(() => []);
  const pools = discoveredPools(chainId);
  const seen = new Set<string>();
  if (pools.length) {
    await mapChunk(pools, 40, async (p) => {
      const id = p.pool.toLowerCase();
      if (seen.has(id)) return null;
      seen.add(id);
      try {
        const bal = await client.readContract({
          address: p.pool as Address,
          abi: erc20BalAbi,
          functionName: "balanceOf",
          args: [user],
        });
        if (bal > 0n) found.push({ a: p.tokenA as Addr, b: p.tokenB as Addr });
      } catch {
        /* skip */
      }
      return null;
    });
    return found;
  }
  for (const venue of venuesOn(chainId).filter((v) => v.kind === "v2" || v.kind === "aero")) {
    for (const s of SEED_PAIRS.filter((p) => p.chainId === chainId)) {
      try {
        const addrs: Address[] = [];
        if (venue.kind === "aero") {
          const [vol, st] = await Promise.all([
            client.readContract({ address: venue.factory, abi: aeroFactoryAbi, functionName: "getPool", args: [s.a.address, s.b.address, false] }),
            client.readContract({ address: venue.factory, abi: aeroFactoryAbi, functionName: "getPool", args: [s.a.address, s.b.address, true] }),
          ]);
          if (vol && vol !== ZERO) addrs.push(vol);
          if (st && st !== ZERO) addrs.push(st);
        } else {
          const pool = await client.readContract({
            address: venue.factory,
            abi: v2FactoryAbi,
            functionName: "getPair",
            args: [s.a.address, s.b.address],
          });
          if (pool && pool !== ZERO) addrs.push(pool);
        }
        for (const pool of addrs) {
          const bal = await client.readContract({ address: pool, abi: erc20BalAbi, functionName: "balanceOf", args: [user] });
          if (bal > 0n) found.push({ a: s.a.address, b: s.b.address });
        }
      } catch {
        /* skip */
      }
    }
  }
  return found;
}

async function v3Positions(client: PublicClient, chainId: number, user: Address) {
  const found: Array<{ a: Addr; b: Addr }> = [];
  for (const venue of venuesOn(chainId).filter((v) => v.kind === "v3" && v.npm)) {
    try {
      const n = await client.readContract({ address: venue.npm!, abi: npmAbi, functionName: "balanceOf", args: [user] });
      const count = Math.min(Number(n), 30);
      if (!count) continue;
      const ids = await client.multicall({
        contracts: Array.from({ length: count }, (_, i) => ({
          address: venue.npm!,
          abi: npmAbi,
          functionName: "tokenOfOwnerByIndex" as const,
          args: [user, BigInt(i)],
        })),
        allowFailure: true,
      });
      const tokenIds = ids.filter((x) => x.status === "success").map((x) => x.result as bigint);
      const pos = await client.multicall({
        contracts: tokenIds.map((id) => ({ address: venue.npm!, abi: npmAbi, functionName: "positions" as const, args: [id] })),
        allowFailure: true,
      });
      for (const p of pos) {
        if (p.status !== "success") continue;
        const row = p.result as unknown as { token0: Address; token1: Address; liquidity: bigint };
        if (!row.liquidity) continue;
        found.push({ a: canonAddr(row.token0), b: canonAddr(row.token1) });
      }
    } catch {
      /* skip */
    }
  }
  return found;
}

export function useDexLp(
  address: Address | undefined,
  chainFilter: number | "all",
  native?: { near?: string; cardanoUnits?: string[] },
) {
  const config = useConfig();
  const [rows, setRows] = useState<MyLpRow[]>([]);
  const [loading, setLoading] = useState(false);
  const near = native?.near ?? "";
  const adaKey = (native?.cardanoUnits ?? []).join("|");

  useEffect(() => {
    if (!address && !near && !adaKey) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const chainIds = [...new Set(SEED_PAIRS.map((p) => p.chainId))].filter((id) => chainFilter === "all" || id === chainFilter);
    void (async () => {
      const acc = new Map<string, MyLpRow>();
      if (address) {
        for (const chainId of chainIds) {
          await trackLive(`lp:${chainId}`, chainId, "lp", async () => {
            const client = getPublicClient(config, { chainId });
            if (!client) return;
            const hits = [...(await v2Positions(client, chainId, address)), ...(await v3Positions(client, chainId, address))];
            for (const h of hits) {
              const id = pairId(chainId, h.a, h.b);
              const ma = seedMeta(chainId, h.a);
              const mb = seedMeta(chainId, h.b);
              const venues = await readVenuesForPair(client, chainId, h.a, h.b, ma?.decimals ?? 18, mb?.decimals ?? 18).catch(() => []);
              const names = [...new Set(venues.map((v) => v.venue.name))];
              const price = weightedPrice(venues);
              acc.set(id, {
                pairId: id,
                chainId,
                symbolA: ma?.symbol ?? h.a.slice(0, 6),
                symbolB: mb?.symbol ?? h.b.slice(0, 6),
                tokenA: h.a,
                tokenB: h.b,
                iconA: ma?.icon ?? "/tokens/eth.png",
                iconB: mb?.icon ?? "/tokens/eth.png",
                venueCount: names.length || 1,
                venueNames: names,
                valueHint: price != null ? String(price) : "—",
              });
            }
          }).catch(() => undefined);
        }
      }
      if (near && (chainFilter === "all" || chainFilter === 397)) {
        await trackLive("lp:397", 397, "lp", async () => {
          for (const h of await nearMyLp(near).catch(() => [])) acc.set(h.pairId, h);
        }).catch(() => undefined);
      }
      if (adaKey && (chainFilter === "all" || chainFilter === 1815)) {
        await trackLive("lp:1815", 1815, "lp", async () => {
          const units = adaKey.split("|").filter(Boolean);
          for (const h of await adaMyLp(units).catch(() => [])) {
            acc.set(h.pairId, {
              pairId: h.pairId,
              chainId: h.chainId,
              symbolA: h.symbolA,
              symbolB: h.symbolB,
              tokenA: h.tokenA,
              tokenB: h.tokenB,
              iconA: h.iconA,
              iconB: h.iconB,
              venueCount: h.venueNames.length || 1,
              venueNames: h.venueNames,
              valueHint: "—",
            });
          }
        }).catch(() => undefined);
      }
      if (!cancelled) {
        setRows([...acc.values()]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      useLiveStatus.getState().clear("lp:");
    };
  }, [address, chainFilter, config, near, adaKey]);

  return { rows, loading };
}
