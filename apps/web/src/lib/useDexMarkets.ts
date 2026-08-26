import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { CHAINS, featuredChains } from "@ysk-mint/config";
import { SEED_PAIRS, isStable } from "./dexVenues.ts";
import { readVenuesForPair, type VenuePool } from "./dexPools.ts";
import { pairId } from "./pairKey.ts";
import { quoteUsd } from "./defi/quote.ts";
import { ensureProtocols } from "./defi/protocols.ts";
import { protocolsOn } from "./defi/registry.ts";

export type MarketRow = {
  pairId: string;
  chainId: number;
  chainShort: string;
  symbolA: string;
  symbolB: string;
  iconA: string;
  iconB: string;
  tokenA: string;
  tokenB: string;
  venues: VenuePool[];
  price: number | null;
  depth: number;
  venueNames: string[];
};

function explorerChain(chainId: number) {
  return Object.values(CHAINS).find((c) => c.chainId === chainId);
}

const RPC_FALLBACK: Record<number, string> = {
  1: "https://ethereum-rpc.publicnode.com",
  8453: "https://base.publicnode.com",
  42161: "https://arbitrum-one-rpc.publicnode.com",
  56: "https://bsc-rpc.publicnode.com",
  43114: "https://avalanche-c-chain-rpc.publicnode.com",
};

async function loadEvm(chainId: number): Promise<MarketRow[]> {
  const chain = explorerChain(chainId);
  if (!chain?.rpc) return [];
  const url = RPC_FALLBACK[chainId] ?? chain.rpc;
  const client = createPublicClient({ transport: http(url) });
  const seeds = SEED_PAIRS.filter((p) => p.chainId === chainId);
  const rows: MarketRow[] = [];
  await Promise.all(
    seeds.map(async (s) => {
      const venues = await readVenuesForPair(client, chainId, s.a.address, s.b.address, s.a.decimals, s.b.decimals).catch(
        () => [] as VenuePool[],
      );
      if (!venues.length) return;
      const usd = await quoteUsd({ evm: client }, chainId, s.a.address, s.a.decimals, false).catch(() => null);
      const names = [...new Set(venues.map((v) => v.venue.name))];
      const depth = venues.reduce((n, v) => n + v.tvlQuote, 0);
      rows.push({
        pairId: pairId(chainId, s.a.address, s.b.address),
        chainId,
        chainShort: chain.short,
        symbolA: s.a.symbol,
        symbolB: s.b.symbol,
        iconA: s.a.icon,
        iconB: s.b.icon,
        tokenA: s.a.address,
        tokenB: s.b.address,
        venues,
        price: usd?.usdc ?? (isStable(s.a.symbol) ? 1 : null),
        depth: usd?.depth ?? depth,
        venueNames: names,
      });
    }),
  );
  return rows;
}

function sortMarkets(rows: MarketRow[]) {
  const order = featuredChains().map((c) => c.chainId);
  rows.sort((a, b) => {
    const d = order.indexOf(a.chainId) - order.indexOf(b.chainId);
    if (d !== 0) return d;
    return (b.depth || 0) - (a.depth || 0);
  });
  return rows;
}

export function useDexMarkets(chainId: number | "all") {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRows([]);
    ensureProtocols();
    const ids =
      chainId === "all"
        ? featuredChains()
            .filter((c) => !c.testnet)
            .map((c) => c.chainId)
        : [chainId];
    void (async () => {
      try {
        const evmIds = ids.filter((id) => ![101, 397, 1815, 398, 18151, 103].includes(id));
        const nativeIds = ids.filter((id) => [101, 397, 1815].includes(id));
        const jobs: Array<Promise<void>> = [];
        const acc: MarketRow[] = [];
        const push = (part: MarketRow[]) => {
          if (cancelled || !part.length) return;
          acc.push(...part);
          setRows(sortMarkets([...acc]));
        };
        for (const id of evmIds) {
          jobs.push(
            loadEvm(id)
              .then(push)
              .catch(() => undefined),
          );
        }
        for (const id of nativeIds) {
          jobs.push(
            Promise.all(protocolsOn(id).map((p) => p.markets?.({}).catch(() => []) ?? Promise.resolve([])))
              .then((parts) => {
                const mapped: MarketRow[] = parts.flat().map((r) => ({
                  ...r,
                  venues: [],
                }));
                push(mapped);
              })
              .catch(() => undefined),
          );
        }
        await Promise.all(jobs);
        if (!cancelled && !acc.length) setRows([]);
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setError(e instanceof Error ? e.message : "rpc");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chainId]);

  return { rows, loading, error };
}
