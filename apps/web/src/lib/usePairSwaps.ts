import { useEffect, useRef, useState } from "react";
import { trackLive, useLiveStatus } from "./liveStatus.ts";
import { formatUnits, parseAbiItem, type PublicClient } from "viem";
import type { VenuePool } from "./dexPools.ts";
import { asAddr } from "./pairKey.ts";

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

function pushLog(rows: SwapRow[], v: VenuePool, v3: boolean, l: { transactionHash?: string; logIndex?: number; blockNumber?: bigint; args?: unknown }, dec0: number, dec1: number) {
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

export async function fetchSwaps(client: PublicClient, venues: VenuePool[], dec0: number, dec1: number): Promise<SwapFetch> {
  const latest = await client.getBlockNumber();
  const rows: SwapRow[] = [];
  const seen = new Set<string>();
  let ok = 0;
  let fail = 0;
  for (const v of venues.slice(0, 8)) {
    const v3 = v.venue.kind === "v3";
    let span = 0n;
    let win = WINDOW;
    let poolOk = false;
    while (span < MAX_SPAN && rows.length < MAX_ROWS) {
      const to = latest - span;
      const from = to > win ? to - win + 1n : 0n;
      try {
        const logs = await client.getLogs({
          address: asAddr(v.pool),
          event: v3 ? v3Swap : v2Swap,
          fromBlock: from,
          toBlock: to,
        });
        poolOk = true;
        for (const l of logs) {
          const id = `${l.transactionHash}-${l.logIndex}`;
          if (seen.has(id)) continue;
          seen.add(id);
          pushLog(rows, v, v3, l, dec0, dec1);
        }
        win = WINDOW;
        span += to >= from ? to - from + 1n : win;
        if (from === 0n) break;
      } catch {
        if (win > 200n) {
          win /= 2n;
          continue;
        }
        fail += 1;
        break;
      }
    }
    if (poolOk) ok += 1;
    else fail += 1;
  }
  return {
    rows: rows.sort((a, b) => Number(b.block - a.block)).slice(0, MAX_ROWS),
    rpcError: ok === 0 && fail > 0,
  };
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
      setRows([]);
      setRpcError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setRpcError(false);
    const job = chainId
      ? trackLive(`trades:${chainId}`, chainId, "trades", () => fetchSwaps(client, list, dec0, dec1))
      : fetchSwaps(client, list, dec0, dec1);
    void job
      .then((r) => {
        if (!cancelled) {
          setRows(r.rows);
          setRpcError(r.rpcError);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setRpcError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (chainId) useLiveStatus.getState().finish(`trades:${chainId}`, true);
    };
  }, [client, key, dec0, dec1, chainId]);
  return { rows, loading, rpcError };
}
