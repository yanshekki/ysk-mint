import { accountCache } from "../defi/cache.ts";
import { rpcOutboundFetch, rpcTry } from "../rpcPool.ts";
import { fmtAmt, type StakeLine } from "./shared.ts";

const PAGE_CAP = 40;

const COSMOS: Record<number, { denom: string; symbol: string; chain: string; icon: string }> = {
  118: { denom: "uatom", symbol: "ATOM", chain: "ATOM", icon: "/tokens/atom.png" },
  100001: { denom: "uosmo", symbol: "OSMO", chain: "OSMO", icon: "/tokens/osmo.png" },
  100002: { denom: "utia", symbol: "TIA", chain: "TIA", icon: "/tokens/tia.png" },
};

type Del = { delegation?: { validator_address?: string; shares?: string }; balance?: { denom?: string; amount?: string } };

async function lcdPages<T>(chainId: number, path: string, field: string): Promise<T[]> {
  const all: T[] = [];
  let key: string | undefined;
  for (let page = 0; page < PAGE_CAP; page++) {
    const json = await rpcTry(chainId, async (lcd, signal) => {
      const u = new URL(`${lcd.replace(/\/+$/, "")}${path}`);
      u.searchParams.set("pagination.limit", "200");
      if (key) u.searchParams.set("pagination.key", key);
      const r = await rpcOutboundFetch(u.href, { signal });
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<Record<string, unknown>>;
    });
    const rows = json[field];
    if (Array.isArray(rows)) all.push(...(rows as T[]));
    const next = (json.pagination as { next_key?: string | null } | undefined)?.next_key;
    if (!next) break;
    key = next;
  }
  return all;
}

export async function readCosmosStake(chainId: number, addr: string): Promise<StakeLine[]> {
  if (!addr || !COSMOS[chainId]) return [];
  return accountCache("pos.stake", chainId, addr, "cosmos", () => readCosmosStakeWork(chainId, addr));
}

async function readCosmosStakeWork(chainId: number, addr: string): Promise<StakeLine[]> {
  const meta = COSMOS[chainId];
  if (!meta) return [];
  const dels = await lcdPages<Del>(chainId, `/cosmos/staking/v1beta1/delegations/${addr}`, "delegation_responses");
  const out: StakeLine[] = [];
  for (const d of dels) {
    if (d.balance?.denom && d.balance.denom !== meta.denom) continue;
    let raw = 0n;
    try {
      raw = BigInt(d.balance?.amount || "0");
    } catch {
      continue;
    }
    if (raw <= 0n) continue;
    const validator = d.delegation?.validator_address || "";
    out.push({
      id: `cosmos-stk-${chainId}-${validator || out.length}`,
      chainId,
      chain: meta.chain,
      symbol: meta.symbol,
      name: `${meta.symbol} delegation`,
      icon: meta.icon,
      amount: fmtAmt(raw, 6),
      raw,
      contract: validator || undefined,
      side: "stake",
      extra: validator ? validator.slice(0, 16) : undefined,
      quote: null,
      valueUsdc: null,
      status: "active",
      inWallet: false,
    });
  }
  return out;
}

export async function cosmosDelegatedRaw(chainId: number, addr: string): Promise<bigint> {
  const lines = await readCosmosStake(chainId, addr);
  return lines.reduce((s, l) => s + l.raw, 0n);
}
