import { useEffect, useRef, useState } from "react";
import { cancelLive, trackLive } from "./liveStatus.ts";
import { formatUnits, parseAbiItem, type Address, type PublicClient } from "viem";
import type { VenuePool } from "./dexPools.ts";
import { asAddr, canonAddr } from "./pairKey.ts";
import { cacheGet, cacheKey, cacheLastGood, mapChunk, onVisibleInterval, POLICIES } from "./defi/cache.ts";
import { v2PairAbi } from "./defi/evm/abis.ts";

const v2Swap = parseAbiItem(
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
);
const v3Swap = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
);

const WINDOW = 2000n;
const MAX_SPAN = 10_000n;
const MAX_ROWS = 50;
const token0Abi = [{ type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }] as const;

export type SwapRow = {
  id: string;
  venue: string;
  pool: string;
  tx?: string;
  to?: string;
  block: bigint;
  ts?: number;
  amountA: number;
  amountB: number;
  side: "buy" | "sell";
  price: number | null;
};

export type SwapFetch = { rows: SwapRow[]; rpcError: boolean };

type SwapPack = { rows: SwapRow[]; scannedToBlock: string; rpcError: boolean };

function asBlock(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string" && v) return BigInt(v);
  return 0n;
}

function asNum(v: unknown) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function reviveRow(r: SwapRow): SwapRow {
  return {
    ...r,
    block: asBlock(r.block),
    ts: r.ts ? asNum(r.ts) : undefined,
    amountA: asNum(r.amountA),
    amountB: asNum(r.amountB),
    price: r.price == null ? null : asNum(r.price),
    side: r.side === "sell" ? "sell" : "buy",
  };
}

function abs(n: bigint) {
  return n < 0n ? -n : n;
}

function asBig(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(v);
  if (typeof v === "string" && /^-?\d+$/.test(v)) return BigInt(v);
  return 0n;
}

function poolDeltas(v3: boolean, args: Record<string, unknown>): { d0: bigint; d1: bigint; to?: string } {
  const to = args.recipient != null ? String(args.recipient) : args.to != null ? String(args.to) : undefined;
  if (v3) return { d0: asBig(args.amount0), d1: asBig(args.amount1), to };
  return {
    d0: asBig(args.amount0In) - asBig(args.amount0Out),
    d1: asBig(args.amount1In) - asBig(args.amount1Out),
    to,
  };
}

function pushLog(
  rows: SwapRow[],
  v: VenuePool,
  v3: boolean,
  l: { transactionHash?: string; logIndex?: number; blockNumber?: bigint; args?: unknown },
  token0: string,
  tokenA: string,
  decA: number,
  decB: number,
) {
  const args = (l.args ?? {}) as Record<string, unknown>;
  const { d0, d1, to } = poolDeltas(v3, args);
  const token0IsA = canonAddr(token0) === canonAddr(tokenA);
  const dA = token0IsA ? d0 : d1;
  const dB = token0IsA ? d1 : d0;
  const amountA = Number(formatUnits(abs(dA), decA));
  const amountB = Number(formatUnits(abs(dB), decB));
  if (!Number.isFinite(amountA) || !Number.isFinite(amountB)) return;
  if (amountA === 0 && amountB === 0) return;
  const price = amountA > 0 && amountB > 0 ? amountB / amountA : null;
  rows.push({
    id: `${l.transactionHash}-${l.logIndex}`,
    venue: `${v.venue.name} ${v.feeLabel}`,
    pool: v.pool,
    tx: l.transactionHash,
    to,
    block: l.blockNumber ?? 0n,
    amountA,
    amountB,
    side: dA < 0n ? "buy" : "sell",
    price,
  });
}

async function readToken0(client: PublicClient, chainId: number, pool: Address): Promise<string> {
  return cacheGet(
    {
      key: cacheKey("meta.pool", chainId, pool, "token0"),
      policy: { ...POLICIES.meta, keep: (addr: string) => Boolean(addr) },
    },
    async () => {
      const token0 = await client.readContract({ address: pool, abi: token0Abi, functionName: "token0" }).catch(() =>
        client.readContract({ address: pool, abi: v2PairAbi, functionName: "token0" }),
      );
      return String(token0);
    },
  );
}

async function attachTimes(client: PublicClient, chainId: number, rows: SwapRow[]) {
  const need = [...new Set(rows.filter((r) => !r.ts && r.block > 0n).map((r) => r.block.toString()))];
  if (!need.length) return;
  await mapChunk(need, 8, async (b) => {
    try {
      const ts = await cacheGet(
        { key: cacheKey("meta.block", chainId, b), policy: POLICIES.meta },
        async () => {
          const block = await client.getBlock({ blockNumber: BigInt(b) });
          return Number(block.timestamp);
        },
      );
      for (const r of rows) {
        if (r.block.toString() === b) r.ts = ts;
      }
    } catch {
      /* keep block-only */
    }
  });
}

async function fetchPoolSwaps(
  client: PublicClient,
  v: VenuePool,
  tokenA: string,
  decA: number,
  decB: number,
  chainId: number,
  latest: bigint,
): Promise<SwapPack> {
  const key = cacheKey("swaps", chainId, asAddr(v.pool), "v2");
  const policy = { ...POLICIES.swaps, keep: (p: SwapPack) => p.rows.length > 0 };
  return cacheGet(
    { key, policy, cursor: (p) => p.scannedToBlock },
    async () => {
      const prev = cacheLastGood<SwapPack>(key);
      const prevRows = (prev?.rows ?? []).map(reviveRow);
      const floor = latest > MAX_SPAN ? latest - MAX_SPAN + 1n : 0n;
      const cursor = prev?.scannedToBlock ? asBlock(prev.scannedToBlock) : 0n;
      let from = cursor > 0n ? cursor + 1n : floor;
      if (from < floor) from = floor;
      if (from > latest) {
        return prev ? { ...prev, rows: prevRows } : { rows: [], scannedToBlock: String(latest), rpcError: false };
      }
      const v3 = v.venue.kind === "v3";
      const token0 = await readToken0(client, chainId, asAddr(v.pool)).catch(() => tokenA);
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
            pushLog(rows, v, v3, l, token0, tokenA, decA, decB);
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
      await attachTimes(client, chainId, rows);
      return {
        rows: rows.sort((a, b) => Number(asBlock(b.block) - asBlock(a.block))).slice(0, MAX_ROWS),
        scannedToBlock: String(scanned > 0n ? scanned : latest),
        rpcError: !ok && fail,
      };
    },
  );
}

export async function fetchSwaps(
  client: PublicClient,
  venues: VenuePool[],
  tokenA: string,
  decA: number,
  decB: number,
  chainId?: number,
): Promise<SwapFetch> {
  const latest = await client.getBlockNumber();
  const cid = chainId ?? 0;
  const packs = await Promise.all(venues.slice(0, 8).map((v) => fetchPoolSwaps(client, v, tokenA, decA, decB, cid, latest)));
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
      rows.push(reviveRow(r));
    }
  }
  const list = rows.sort((a, b) => Number(asBlock(b.block) - asBlock(a.block))).slice(0, MAX_ROWS);
  if (cid) await attachTimes(client, cid, list);
  return {
    rows: list,
    rpcError: ok === 0 && fail > 0,
  };
}

function seedSwaps(chainId: number | undefined, venues: VenuePool[]): SwapRow[] {
  if (!chainId) return [];
  const rows: SwapRow[] = [];
  const seen = new Set<string>();
  for (const v of venues.slice(0, 8)) {
    const pack = cacheLastGood<SwapPack>(cacheKey("swaps", chainId, asAddr(v.pool), "v2"));
    for (const r of pack?.rows ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      rows.push(reviveRow(r));
    }
  }
  return rows.sort((a, b) => Number(asBlock(b.block) - asBlock(a.block))).slice(0, MAX_ROWS);
}

export function usePairSwaps(
  client: PublicClient | undefined,
  venues: VenuePool[],
  tokenA: string,
  decA: number,
  decB: number,
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
    if (!client || !list.length || !tokenA) {
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

    const run = () => fetchSwaps(client, list, tokenA, decA, decB, chainId);
    const job = chainId ? trackLive(`trades:${chainId}`, chainId, "trades", run) : run();
    void job
      .then((r) => {
        if (cancelled) return;
        if (r.rows.length) setRows(r.rows);
        setRpcError(r.rpcError);
      })
      .catch(() => {
        if (!cancelled && !seeded.length) {
          setRows([]);
          setRpcError(true);
        } else if (!cancelled) setRpcError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const stop = onVisibleInterval(30_000, () => {
      if (cancelled || !client) return;
      const again = chainId ? trackLive(`trades:${chainId}`, chainId, "trades", run) : run();
      void again
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
  }, [client, key, tokenA, decA, decB, chainId]);
  return { rows, loading, rpcError };
}
