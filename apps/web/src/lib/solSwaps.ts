import { cacheGet, cacheKey, cacheLastGood, POLICIES } from "./defi/cache.ts";
import { geckoEnqueue } from "./defi/http/geckoDex.ts";
import { outboundFetch } from "./outbound.ts";
import type { VenuePool } from "./dexPools.ts";
import type { SwapRow } from "./usePairSwaps.ts";

const GECKO = "https://api.geckoterminal.com/api/v2/networks/solana/pools";

type GeckoTrade = {
  id?: string;
  attributes?: {
    block_number?: string | number;
    tx_hash?: string;
    from_token_amount?: string;
    to_token_amount?: string;
    from_token_address?: string;
    to_token_address?: string;
    kind?: string;
    block_timestamp?: string;
  };
};

function num(x: unknown) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

function sameMint(a: string, b: string) {
  const x = a.trim();
  const y = b.trim();
  return x === y || x.toLowerCase() === y.toLowerCase();
}

function toRow(tr: GeckoTrade, v: VenuePool, tokenA: string): SwapRow | null {
  const a = tr.attributes ?? {};
  const from = String(a.from_token_address ?? "");
  const to = String(a.to_token_address ?? "");
  const fromAmt = num(a.from_token_amount);
  const toAmt = num(a.to_token_amount);
  if (!from || !to || fromAmt <= 0 || toAmt <= 0) return null;
  const sellingA = sameMint(from, tokenA);
  const buyingA = sameMint(to, tokenA);
  if (!sellingA && !buyingA) return null;
  const amountA = sellingA ? fromAmt : toAmt;
  const amountB = sellingA ? toAmt : fromAmt;
  const ts = a.block_timestamp ? Math.floor(Date.parse(a.block_timestamp) / 1000) : undefined;
  const block = BigInt(String(a.block_number ?? 0).replace(/[^\d]/g, "") || "0");
  const tx = a.tx_hash || undefined;
  return {
    id: tr.id || `${tx}-${a.block_number}`,
    venue: `${v.venue.name} ${v.feeLabel}`.trim(),
    venueName: v.venue.name,
    feeLabel: v.feeLabel,
    pool: v.pool,
    tx,
    block,
    ts: Number.isFinite(ts) ? ts : undefined,
    amountA,
    amountB,
    side: buyingA ? "buy" : "sell",
    price: amountA > 0 && amountB > 0 ? amountB / amountA : null,
  };
}

async function geckoTrades(pool: string): Promise<GeckoTrade[]> {
  const url = `${GECKO}/${encodeURIComponent(pool)}/trades`;
  return geckoEnqueue(async () => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15000);
    try {
      const res = await outboundFetch(url, { signal: ac.signal, headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`gecko ${res.status}`);
      const json = (await res.json()) as { data?: GeckoTrade[] };
      return json.data ?? [];
    } finally {
      clearTimeout(t);
    }
  });
}

export async function fetchSolSwaps(venues: VenuePool[], tokenA: string): Promise<{ rows: SwapRow[]; rpcError: boolean }> {
  const list = venues.filter((v) => v.pool).slice(0, 8);
  if (!list.length || !tokenA) return { rows: [], rpcError: false };
  const packs = await Promise.all(
    list.map(async (v) => {
      try {
        const part = await cacheGet(
          {
            key: cacheKey("swaps", 101, v.pool, "gt"),
            policy: { ...POLICIES.swaps, keep: (rows: SwapRow[]) => rows.length > 0 },
          },
          async () => {
            const trades = await geckoTrades(v.pool);
            const rows: SwapRow[] = [];
            const seen = new Set<string>();
            for (const tr of trades) {
              const row = toRow(tr, v, tokenA);
              if (!row || seen.has(row.id)) continue;
              seen.add(row.id);
              rows.push(row);
            }
            return rows;
          },
        );
        return { rows: part, fail: false };
      } catch {
        return { rows: [] as SwapRow[], fail: true };
      }
    }),
  );
  const rows: SwapRow[] = [];
  const seen = new Set<string>();
  let fail = 0;
  for (const part of packs) {
    if (part.fail) fail += 1;
    for (const r of part.rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      rows.push(r);
    }
  }
  rows.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0) || Number(b.block - a.block));
  return { rows, rpcError: fail === list.length };
}

export function seedSolSwaps(venues: VenuePool[]): SwapRow[] {
  const rows: SwapRow[] = [];
  const seen = new Set<string>();
  for (const v of venues.slice(0, 8)) {
    const part = cacheLastGood<SwapRow[]>(cacheKey("swaps", 101, v.pool, "gt")) ?? [];
    for (const r of part) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      rows.push(r);
    }
  }
  return rows.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0) || Number(b.block - a.block));
}
