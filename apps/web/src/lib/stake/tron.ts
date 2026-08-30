import { accountCache } from "../defi/cache.ts";
import { rpcOutboundFetch, rpcTry } from "../rpcPool.ts";
import { fmtAmt, type StakeLine } from "./shared.ts";

type FrozenRow = { frozen_balance?: number; amount?: number; type?: string };

function sunOf(v: unknown) {
  if (v == null) return 0n;
  try {
    if (typeof v === "bigint") return v;
    if (typeof v === "number") return BigInt(Math.trunc(v));
    return BigInt(String(v));
  } catch {
    return 0n;
  }
}

export function tronFrozenSun(acc: Record<string, unknown> | undefined): bigint {
  if (!acc) return 0n;
  let sum = 0n;
  const frozen = acc.frozen;
  if (Array.isArray(frozen)) {
    for (const row of frozen as FrozenRow[]) sum += sunOf(row.frozen_balance ?? row.amount);
  }
  const frozenV2 = acc.frozenV2;
  if (Array.isArray(frozenV2)) {
    for (const row of frozenV2 as FrozenRow[]) sum += sunOf(row.amount ?? row.frozen_balance);
  }
  const res = acc.account_resource;
  if (res && typeof res === "object") {
    const energy = (res as { frozen_balance_for_energy?: FrozenRow }).frozen_balance_for_energy;
    sum += sunOf(energy?.frozen_balance ?? energy?.amount);
  }
  sum += sunOf(acc.delegated_frozenV2_balance_for_bandwidth);
  sum += sunOf(acc.delegated_frozenV2_balance_for_energy);
  return sum;
}

export async function readTronStake(addr: string): Promise<StakeLine[]> {
  if (!addr) return [];
  return accountCache("pos.stake", 728126428, addr, "tron", () => readTronStakeWork(addr));
}

async function readTronStakeWork(addr: string): Promise<StakeLine[]> {
  const json = await rpcTry(728126428, async (base, signal) => {
    const r = await rpcOutboundFetch(`${base.replace(/\/+$/, "")}/v1/accounts/${addr}`, { signal });
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<{ data?: Array<Record<string, unknown>> }>;
  });
  const raw = tronFrozenSun(json.data?.[0]);
  if (raw <= 0n) return [];
  return [
    {
      id: `tron-stk-${addr}`,
      chainId: 728126428,
      chain: "TRX",
      symbol: "TRX",
      name: "Frozen TRX",
      icon: "/tokens/trx.png",
      amount: fmtAmt(raw, 6),
      raw,
      side: "stake",
      extra: "Stake 2.0",
      quote: null,
      valueUsdc: null,
      status: "active",
      inWallet: false,
    },
  ];
}
