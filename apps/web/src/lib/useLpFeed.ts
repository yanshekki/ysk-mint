import { useEffect, useMemo, useState } from "react";
import { createPublicClient, formatUnits, http, parseAbiItem } from "viem";
import { CHAINS, featuredChains, isConfigured, launchContracts, type ChainDefinition } from "@ysk-mint/config";

const lpEvent = parseAbiItem(
  "event LiquidityLaunched(address indexed token, address indexed lpToken, address indexed user, uint256 liquidity, uint256 lockId)",
);
const lockEvent = parseAbiItem(
  "event Locked(uint256 indexed lockId, address indexed token, address indexed owner, uint256 amount, uint8 mode, uint64 unlockAt)",
);
const launchEvent = parseAbiItem(
  "event Launch(address indexed token, address indexed deployer, bytes32 indexed salt, string name, string symbol, uint8 supplyMode)",
);

export type LpRow = {
  chainKey: number;
  chainId: number;
  chainShort: string;
  chainName: string;
  token: `0x${string}`;
  lpToken: `0x${string}`;
  lockId: string;
  liquidity: string;
  mode: number;
  unlockAt: number;
  name: string;
  symbol: string;
  explorer: string;
};

export type LpFilter = "all" | number;

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

async function fetchChain(chain: ChainDefinition): Promise<LpRow[]> {
  const contracts = launchContracts(chain.key);
  if (!chain.evm || !chain.rpc || !isConfigured(contracts)) return [];
  const client = createPublicClient({ transport: http(chain.rpc) });
  const [lpLogs, lockLogs, launchLogs] = await Promise.all([
    client.getLogs({ address: contracts.manager, event: lpEvent, fromBlock: 0n, toBlock: "latest" }),
    client.getLogs({ address: contracts.locker, event: lockEvent, fromBlock: 0n, toBlock: "latest" }),
    client.getLogs({ address: contracts.factory, event: launchEvent, fromBlock: 0n, toBlock: "latest" }),
  ]);
  const meta = new Map<string, { name: string; symbol: string }>();
  for (const l of launchLogs) {
    const token = l.args.token as `0x${string}`;
    meta.set(token.toLowerCase(), { name: (l.args.name as string) || "", symbol: (l.args.symbol as string) || "" });
  }
  const locks = new Map<string, { mode: number; unlockAt: number }>();
  for (const l of lockLogs) {
    locks.set(String(l.args.lockId), {
      mode: Number(l.args.mode ?? 0),
      unlockAt: Number(l.args.unlockAt ?? 0),
    });
  }
  return lpLogs
    .slice()
    .reverse()
    .map((l) => {
      const token = (l.args.token as `0x${string}`) ?? "0x";
      const info = meta.get(token.toLowerCase());
      const lockId = String(l.args.lockId ?? 0n);
      const lock = locks.get(lockId);
      return {
        chainKey: chain.key,
        chainId: chain.chainId,
        chainShort: chain.short,
        chainName: chain.name,
        token,
        lpToken: (l.args.lpToken as `0x${string}`) ?? "0x",
        lockId,
        liquidity: formatUnits(l.args.liquidity ?? 0n, 18),
        mode: lock?.mode ?? 0,
        unlockAt: lock?.unlockAt ?? 0,
        name: info?.name ?? shortAddr(token),
        symbol: info?.symbol ?? "LP",
        explorer: chain.explorer,
      };
    });
}

export function useLpFeed(filter: LpFilter) {
  const [rows, setRows] = useState<LpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targets = useMemo(() => {
    if (filter === "all") return featuredChains().filter((c) => c.evm);
    const one = CHAINS[filter as keyof typeof CHAINS];
    return one?.evm ? [one] : [];
  }, [filter]);

  const selected = filter === "all" ? undefined : CHAINS[filter as keyof typeof CHAINS];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    if (selected && !selected.evm) {
      setRows([]);
      setLoading(false);
      return;
    }
    const live = targets.filter((c) => isConfigured(launchContracts(c.key)));
    if (live.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    void Promise.all(live.map((c) => fetchChain(c)))
      .then((parts) => {
        if (cancelled) return;
        setRows(parts.flat());
      })
      .catch((e) => {
        if (cancelled) return;
        setRows([]);
        setError(e instanceof Error ? e.message : "rpc");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [targets, selected]);

  return { rows, loading, error, selected };
}
