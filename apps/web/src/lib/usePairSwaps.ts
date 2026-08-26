import { useEffect, useState } from "react";
import { formatUnits, parseAbiItem, type PublicClient } from "viem";
import type { VenuePool } from "./dexPools.ts";

const v2Swap = parseAbiItem(
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
);
const v3Swap = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
);

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

export async function fetchSwaps(client: PublicClient, venues: VenuePool[], dec0: number, dec1: number): Promise<SwapRow[]> {
  const latest = await client.getBlockNumber();
  const from = latest > 2500n ? latest - 2500n : 0n;
  const rows: SwapRow[] = [];
  for (const v of venues.slice(0, 6)) {
    const v3 = v.venue.kind === "v3";
    try {
      const logs = await client.getLogs({
        address: v.pool,
        event: v3 ? v3Swap : v2Swap,
        fromBlock: from,
        toBlock: "latest",
      });
      for (const l of logs.slice(-20)) {
        const args = l.args as Record<string, bigint | undefined>;
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
    } catch {
      /* skip venue */
    }
  }
  return rows.sort((a, b) => Number(b.block - a.block)).slice(0, 50);
}

export function usePairSwaps(client: PublicClient | undefined, venues: VenuePool[], dec0: number, dec1: number) {
  const [rows, setRows] = useState<SwapRow[]>([]);
  const [loading, setLoading] = useState(false);
  const key = venues.map((v) => v.pool).join(",");
  useEffect(() => {
    if (!client || !venues.length) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchSwaps(client, venues, dec0, dec1)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, key, dec0, dec1, venues]);
  return { rows, loading };
}
