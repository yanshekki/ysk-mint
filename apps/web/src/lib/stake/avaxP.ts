import { formatUnits } from "viem";
import { accountCache } from "../defi/cache.ts";
import { jsonGet } from "../domainNames/http.ts";
import { outboundFetch } from "../outbound.ts";
import i18n from "../i18n.ts";
import { fmtAmt, utc, type StakeLine } from "./shared.ts";

const GLACIER = "https://glacier-api.avax.network";
const DATA_API = "https://data-api.avax.network";
const P_RPC = "https://api.avax.network/ext/bc/P";
const C_CHAIN_ID = "2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5";
const P_ADDR = /P-avax1[0-9a-z]{20,80}/i;

function collectP(value: unknown, into: Set<string>, depth = 0) {
  if (depth > 8 || value == null) return;
  if (typeof value === "string") {
    const m = value.match(P_ADDR);
    if (m) into.add(m[0]);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectP(v, into, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectP(v, into, depth + 1);
  }
}

async function glacierJson<T>(path: string): Promise<T | null> {
  for (const host of [GLACIER, DATA_API]) {
    const json = await jsonGet<T>(`${host}${path}`);
    if (json) return json;
  }
  return null;
}

async function pAddressesFromExports(evm: string): Promise<string[]> {
  const addr = evm.toLowerCase();
  const paths = [
    `/v1/networks/mainnet/blockchains/c-chain/transactions?addresses=${addr}&pageSize=100`,
    `/v1/networks/mainnet/blockchains/c-chain/transactions?addresses=${addr}&txTypes=ExportTx&pageSize=100`,
    `/v1/networks/mainnet/blockchains/${C_CHAIN_ID}/transactions?addresses=${addr}&pageSize=100`,
  ];
  const found = new Set<string>();
  for (const path of paths) {
    const json = await glacierJson<unknown>(path);
    if (!json) continue;
    collectP(json, found);
    if (found.size) break;
  }
  return [...found];
}

async function platformRpc<T>(method: string, params: unknown): Promise<T | null> {
  try {
    const res = await outboundFetch(P_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: T };
    return json.result ?? null;
  } catch {
    return null;
  }
}

function asNAvax(v: unknown): bigint {
  if (v == null) return 0n;
  try {
    return BigInt(String(v));
  } catch {
    return 0n;
  }
}

type StakeTx = {
  txType?: string;
  amountStaked?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  estimatedReward?: string;
  potentialReward?: string;
  nodeId?: string;
  rewardAddresses?: string[];
};

async function glacierStake(pAddr: string): Promise<{ amount: bigint; reward: bigint; start?: number; end?: number; node?: string }> {
  const json = await glacierJson<{
    transactions?: StakeTx[];
    data?: { transactions?: StakeTx[] };
  }>(
    `/v1/networks/mainnet/blockchains/p-chain/transactions:listStaking?addresses=${encodeURIComponent(pAddr)}&pageSize=50`,
  );
  const txs = json?.transactions ?? json?.data?.transactions ?? [];
  let amount = 0n;
  let reward = 0n;
  let start: number | undefined;
  let end: number | undefined;
  let node: string | undefined;
  const now = Date.now() / 1000;
  for (const tx of txs) {
    const endTs = Number(tx.endTimestamp ?? 0);
    if (endTs && endTs < now) continue;
    amount += asNAvax(tx.amountStaked);
    reward += asNAvax(tx.estimatedReward ?? tx.potentialReward);
    const s = Number(tx.startTimestamp ?? 0);
    if (s && (!start || s < start)) start = s;
    if (endTs && (!end || endTs > end)) end = endTs;
    if (tx.nodeId && !node) node = tx.nodeId;
  }
  return { amount, reward, start, end, node };
}

export async function readAvaxPStake(evm: string, avaxUsd?: number | null): Promise<StakeLine[]> {
  if (!evm || !evm.startsWith("0x")) return [];
  return accountCache("pos.stake", 43114, evm, "p-chain", () => readAvaxPStakeWork(evm, avaxUsd));
}

async function readAvaxPStakeWork(evm: string, avaxUsd?: number | null): Promise<StakeLine[]> {
  const pAddrs = await pAddressesFromExports(evm);
  if (!pAddrs.length) return [];
  const out: StakeLine[] = [];
  for (const pAddr of pAddrs) {
    const [rpc, glacier] = await Promise.all([
      platformRpc<{ staked?: string }>("platform.getStake", { addresses: [pAddr] }),
      glacierStake(pAddr),
    ]);
    const staked = asNAvax(rpc?.staked) || glacier.amount;
    if (staked === 0n) continue;
    const n = Number(formatUnits(staked, 9));
    const note = glacier.end
      ? i18n.t("stake.avaxPUntil", { when: utc(glacier.end) })
      : i18n.t("stake.avaxPNote");
    out.push({
      id: `avax-p-${pAddr}`,
      chainId: 43114,
      chain: "AVAX",
      symbol: "AVAX",
      name: i18n.t("stake.avaxP"),
      icon: "/tokens/avax.png",
      amount: fmtAmt(staked, 9),
      raw: staked,
      contract: pAddr,
      side: "stake",
      extra: pAddr,
      quote: avaxUsd ? { usdc: avaxUsd, source: "v2" } : null,
      valueUsdc: avaxUsd && Number.isFinite(n) ? n * avaxUsd : null,
      status: "active",
      inWallet: false,
      stakedSince: glacier.start ? utc(glacier.start) : undefined,
      unstakeNote: note,
    });
    if (glacier.reward > 0n) {
      const rn = Number(formatUnits(glacier.reward, 9));
      out.push({
        id: `avax-p-rew-${pAddr}`,
        chainId: 43114,
        chain: "AVAX",
        symbol: "AVAX",
        name: i18n.t("stake.avaxPReward"),
        icon: "/tokens/avax.png",
        amount: fmtAmt(glacier.reward, 9),
        raw: glacier.reward,
        contract: pAddr,
        side: "stake",
        extra: pAddr,
        quote: avaxUsd ? { usdc: avaxUsd, source: "v2" } : null,
        valueUsdc: avaxUsd && Number.isFinite(rn) ? rn * avaxUsd : null,
        status: "claimable",
        inWallet: false,
        unstakeNote: i18n.t("stake.avaxPRewardNote"),
      });
    }
  }
  return out;
}
