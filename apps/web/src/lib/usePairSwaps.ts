import { useEffect, useRef, useState } from "react";
import { cancelLive, trackLive } from "./liveStatus.ts";
import { formatUnits, parseAbiItem, type PublicClient } from "viem";
import type { VenuePool } from "./dexPools.ts";
import { asAddr } from "./pairKey.ts";
import { cacheGet, cacheKey, cacheLastGood, cacheReady, onVisibleInterval, POLICIES } from "./defi/cache.ts";

const v2Swap = parseAbiItem(
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
);
const v3Swap = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
);

const WINDOW = 2000n;
const MAX_SPAN = 10_000n;
const MAX_ROWS = 50;

export type SwapRow = {
  id: string;
  venue: string;
  pool: string;
  tx?: string;
  block: bigint;
  amount0: number;
  amount1: number;
  side: string;
};

export type SwapFetch = { rows: SwapRow[]; rpcError: boolean };

type SwapPack = { rows: SwapRow[]; scannedToBlock: string; rpcError: boolean };

function pushLog(
  rows: SwapRow[],
  v: VenuePool,
  v3: boolean,
  l: { transactionHash?: string; logIndex?: number; blockNumber?: bigint; args?: unknown },
  dec0: number,
  dec1: number,
) {
  const args = (l.args ?? {}) as Record<string, bigint | undefined>;
  let a0 = 0n;
  let a1 = 0n;
  if (v3) {
    a0 = args.amount0 ?? 0n;
    a1 = args.amount1 ?? 0n;
  } else {
    const i0 = args.amount0In ?? 0n;
    const i1 = args.amount1In ?? 0n;
    const o0 = args.amount0Out ?? 0n;
    const o1 = args.amount1Out ?? 0n;
    a0 = o0 > 0n ? -o0 : i0;
    a1 = o1 > 0n ? -o1 : i1;
  }
  rows.push({
    id: `${l.transactionHash}-${l.logIndex}`,
    venue: `${v.venue.name} ${v.feeLabel}`,
    pool: v.pool,
    tx: l.transactionHash,
    block: l.blockNumber ?? 0n,
    amount0: Number(formatUnits(a0 < 0n ? -a0 : a0, dec0)),
    amount1: Number(formatUnits(a1 < 0n ? -a1 : a1, dec1)),
    side: a0 < 0n || (a0 === 0n && a1 > 0n) ? "sell0" : "buy0",
  });
}

function asBlock(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string" && v) return BigInt(v);
  return 0n;
}

async function fetchPoolSwaps(
  client: PublicClient,
  v: VenuePool,
  dec0: number,
  dec1: number,
  chainId: number,
  latest: bigint,
): Promise<SwapPack> {
  const key = cacheKey("swaps", chainId, asAddr(v.pool));
  const policy = { ...POLICIES.swaps, keep: (p: SwapPack) => p.rows.length > 0 };
  return cacheGet(
    { key, policy, cursor: (p) => p.scannedToBlock },
    async () => {
      const prev = cacheLastGood<SwapPack>(key);
      const prevRows = (prev?.rows ?? []).map((r) => ({ ...r, block: asBlock(r.block) }));
      const floor = latest > MAX_SPAN ? latest - MAX_SPAN + 1n : 0n;
      const cursor = prev?.scannedToBlock ? asBlock(prev.scannedToBlock) : 0n;
      let from = cursor > 0n ? cursor + 1n : floor;
      if (from < floor) from = floor;
      if (from > latest) {
        return prev ?? { rows: [], scannedToBlock: String(latest), rpcError: false };
      }
      const v3 = v.venue.kind === "v3";
      const rows: SwapRow[] = [...prevRows];
      const seen = new Set(rows.map((r) => r.id));
      let win = WINDOW;
      let pos = from;
      let scanned = cursor >= floor ? cursor : from - 1n;
      let fail = false;
      let ok = false;
      while (pos <= latest && rows.length < MAX_ROWS * 2) {
        const end = pos + win - 1n > latest ? latest : pos + win - 1n;
        try {
          const logs = await client.getLogs({
            address: asAddr(v.pool),
            event: v3 ? v3Swap : v2Swap,
            fromBlock: pos,
            toBlock: end,
          });
          ok = true;
          for (const l of logs) {
            const id = `${l.transactionHash}-${l.logIndex}`;
            if (seen.has(id)) continue;
            seen.add(id);
            pushLog(rows, v, v3, l, dec0, dec1);
          }
          scanned = end;
          pos = end + 1n;
          win = WINDOW;
        } catch {
          if (win > 200n) {
            win /= 2n;
            continue;
          }
          fail = true;
          break;
        }
      }
      const packed: SwapPack = {
        rows: rows.sort((a, b) => Number(asBlock(b.block) - asBlock(a.block))).slice(0, MAX_ROWS),
        scannedToBlock: String(scanned > 0n ? scanned : latest),
        rpcError: !ok && fail,
      };
      return packed;
    },
  );
}

export async function fetchSwaps(
  client: PublicClient,
  venues: VenuePool[],
  dec0: number,
  dec1: number,
  chainId?: number,
): Promise<SwapFetch> {
  const latest = await client.getBlockNumber();
  const cid = chainId ?? 0;
  const packs = await Promise.all(venues.slice(0, 8).map((v) => fetchPoolSwaps(client, v, dec0, dec1, cid, latest)));
  const rows: SwapRow[] = [];
  const seen = new Set<string>();
  let ok = 0;
  let fail = 0;
  for (const p of packs) {
    if (p.rpcError) fail += 1;
    else ok += 1;
    for (const r of p.rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      rows.push({ ...r, block: asBlock(r.block) });
    }
  }
  return {
    rows: rows.sort((a, b) => Number(asBlock(b.block) - asBlock(a.block))).slice(0, MAX_ROWS),
    rpcError: ok === 0 && fail > 0,
  };
}

function seedSwaps(chainId: number | undefined, venues: VenuePool[]): SwapRow[] {
  if (!chainId) return [];
  const rows: SwapRow[] = [];
  const seen = new Set<string>();
  for (const v of venues.slice(0, 8)) {
    const pack = cacheLastGood<SwapPack>(cacheKey("swaps", chainId, asAddr(v.pool)));
    for (const r of pack?.rows ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      rows.push({ ...r, block: asBlock(r.block) });
    }
  }
  return rows.sort((a, b) => Number(asBlock(b.block) - asBlock(a.block))).slice(0, MAX_ROWS);
}

export function usePairSwaps(
  client: PublicClient | undefined,
  venues: VenuePool[],
  dec0: number,
  dec1: number,
  chainId?: number,
) {
  const [rows, setRows] = useState<SwapRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [rpcError, setRpcError] = useState(false);
  const key = venues.map((v) => v.pool).join(",");
  const venuesRef = useRef(venues);
  venuesRef.current = venues;
  useEffect(() => {
    const list = venuesRef.current;
    if (!client || !list.length) {
      if (!list.length) {
        setRows([]);
        setRpcError(false);
      }
      return;
    }
    let cancelled = false;
    const seeded = seedSwaps(chainId, list);
    if (seeded.length) {
      setRows(seeded);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const run = async () => {
      await cacheReady();
      const job = chainId
        ? trackLive(`trades:${chainId}`, chainId, "trades", () => fetchSwaps(client, list, dec0, dec1, chainId))
        : fetchSwaps(client, list, dec0, dec1, chainId);
      try {
        const r = await job;
        if (cancelled) return;
        if (r.rows.length) setRows(r.rows);
        setRpcError(r.rpcError);
      } catch {
        if (!cancelled && !seeded.length) {
          setRows([]);
          setRpcError(true);
        } else if (!cancelled) setRpcError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    const stop = onVisibleInterval(30_000, () => {
      if (cancelled || !client) return;
      void (chainId
        ? trackLive(`trades:${chainId}`, chainId, "trades", () => fetchSwaps(client, list, dec0, dec1, chainId))
        : fetchSwaps(client, list, dec0, dec1, chainId)
      )
        .then((r) => {
          if (cancelled) return;
          if (r.rows.length) setRows(r.rows);
          setRpcError(r.rpcError);
        })
        .catch(() => {
          if (!cancelled) setRpcError(true);
        });
    });
    return () => {
      cancelled = true;
      stop();
      if (chainId) cancelLive(`trades:${chainId}`);
    };
  }, [client, key, dec0, dec1, chainId]);
  return { rows, loading, rpcError };
}
