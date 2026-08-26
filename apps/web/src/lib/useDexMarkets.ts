import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { CHAINS, featuredChains } from "@ysk-mint/config";
import { SEED_PAIRS, SOL_SEEDS } from "./dexVenues.ts";
import { readVenuesForPair, weightedPrice, type VenuePool } from "./dexPools.ts";
import { pairId } from "./pairKey.ts";
import { quoteSolMints } from "./defiQuotes.ts";
import { loadNearMarkets } from "./nearDex.ts";
import { loadAdaMarkets } from "./adaDex.ts";

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
  for (const s of seeds) {
    const venues = await readVenuesForPair(client, chainId, s.a.address, s.b.address, s.a.decimals, s.b.decimals).catch(() => []);
    if (!venues.length) continue;
    const names = [...new Set(venues.map((v) => v.venue.name))];
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
      price: weightedPrice(venues),
      depth: venues.reduce((n, v) => n + v.tvlQuote, 0),
      venueNames: names,
    });
  }
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
    const ids =
      chainId === "all"
        ? featuredChains()
            .filter((c) => !c.testnet)
            .map((c) => c.chainId)
        : [chainId];
    void (async () => {
      try {
        const evmIds = ids.filter((id) => ![101, 397, 1815, 398, 18151, 103].includes(id));
        const [evmParts, near, ada] = await Promise.all([
          Promise.all(evmIds.map(loadEvm)),
          ids.includes(397) ? loadNearMarkets().catch(() => []) : Promise.resolve([]),
          ids.includes(1815) ? loadAdaMarkets().catch(() => []) : Promise.resolve([]),
        ]);
        const flat = [...evmParts.flat(), ...near, ...ada];
        if (chainId === "all" || chainId === 101) {
          const jup = await quoteSolMints(SOL_SEEDS.map((s) => s.mintA));
          for (const s of SOL_SEEDS) {
            const q = jup.get(s.mintA);
            flat.push({
              pairId: `101:${s.mintA}-${s.mintB}`,
              chainId: 101,
              chainShort: "SOL",
              symbolA: s.symbolA,
              symbolB: s.symbolB,
              iconA: s.iconA,
              iconB: s.iconB,
              tokenA: s.mintA,
              tokenB: s.mintB,
              venues: [],
              price: q?.usdc ?? null,
              depth: 0,
              venueNames: [s.dex],
            });
          }
        }
        const order = featuredChains().map((c) => c.chainId);
        flat.sort((a, b) => {
          const d = order.indexOf(a.chainId) - order.indexOf(b.chainId);
          return d !== 0 ? d : a.symbolA.localeCompare(b.symbolA);
        });
        if (!cancelled) setRows(flat);
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
