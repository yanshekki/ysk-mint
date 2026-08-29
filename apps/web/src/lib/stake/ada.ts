import { formatUnits } from "viem";
import { accountCache } from "../defi/cache.ts";
import { quoteAdaToken } from "../adaDex.ts";
import { addressToHex, hexToBech32, stakeFromPayment } from "../cardanoCip30.ts";
import { koiosGet, koiosPost } from "../koios.ts";
import { outboundFetch } from "../outbound.ts";
import { fmtAmt, utc, type StakeLine } from "./shared.ts";

type AdaAccount = {
  stake_address?: string;
  status?: string;
  delegated_pool?: string;
  total_balance?: string | number;
  utxo?: string | number;
  rewards?: string | number;
  withdrawals?: string | number;
  rewards_available?: string | number;
};

function lovelace(v: unknown): bigint {
  if (v == null || v === "") return 0n;
  try {
    if (typeof v === "number") return BigInt(Math.trunc(v));
    const s = String(v).replace(/"/g, "").trim();
    if (!s || s === "null" || s === "undefined") return 0n;
    return BigInt(s);
  } catch {
    return 0n;
  }
}

function unwrapAccounts(json: unknown): AdaAccount[] {
  if (Array.isArray(json)) return json as AdaAccount[];
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as AdaAccount[];
    if (Array.isArray(o.result)) return o.result as AdaAccount[];
  }
  return [];
}

function adaStakes(primary: string, payments: string[]) {
  const out: string[] = [];
  const push = (s: string) => {
    if (!s.startsWith("stake") || out.includes(s)) return;
    out.push(s);
  };
  push(primary);
  for (const p of payments) push(stakeFromPayment(p));
  return out;
}

function withdrawable(row: AdaAccount) {
  const avail = lovelace(row.rewards_available);
  if (avail > 0n) return avail;
  const earned = lovelace(row.rewards);
  const withdrawn = lovelace(row.withdrawals);
  return earned > withdrawn ? earned - withdrawn : 0n;
}

type YoroiAccount = {
  remainingAmount?: string;
  remainingNonSpendableAmount?: string;
  rewards?: string;
  withdrawals?: string;
  delegation?: string | null;
  stakeRegistered?: boolean;
};

async function yoroiAccounts(stakes: string[]): Promise<{
  rewards: bigint;
  pending: bigint;
  pools: string[];
} | null> {
  const hexes = stakes.map((s) => addressToHex(s)).filter(Boolean);
  if (!hexes.length) return null;
  try {
    const res = await outboundFetch("https://iohk-mainnet.yoroiwallet.com/api/account/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ addresses: hexes }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, YoroiAccount | null>;
    let rewards = 0n;
    let pending = 0n;
    const pools: string[] = [];
    for (const row of Object.values(json)) {
      if (!row) continue;
      rewards += lovelace(row.remainingAmount);
      pending += lovelace(row.remainingNonSpendableAmount);
      if (row.delegation) {
        const pool = hexToBech32("pool", row.delegation);
        if (pool && !pools.includes(pool)) pools.push(pool);
      }
    }
    return { rewards, pending, pools };
  } catch {
    return null;
  }
}

async function koiosAccounts(stakes: string[]): Promise<AdaAccount[]> {
  if (!stakes.length) return [];
  const body = { _stake_addresses: stakes };
  try {
    const rows = unwrapAccounts(await koiosPost("account_info", body));
    if (rows.length) return rows;
  } catch {
    /* cached */
  }
  try {
    return unwrapAccounts(await koiosPost("account_info_cached", body));
  } catch {
    return [];
  }
}

export async function readAdaStake(stakeAddr: string, payments: string[] = []): Promise<StakeLine[]> {
  return accountCache("pos.stake", 1815, stakeAddr || "none", "ada", () => readAdaStakeWork(stakeAddr, payments));
}

async function readAdaStakeWork(stakeAddr: string, payments: string[] = []): Promise<StakeLine[]> {
  const stakes = adaStakes(stakeAddr, payments);
  if (!stakes.length) return [];
  try {
    const yoroi = await yoroiAccounts(stakes);
    const info = yoroi ? [] : await koiosAccounts(stakes);
    if (!yoroi && !info.length) return [];
    let ada = 0n;
    let rewards = yoroi?.rewards ?? 0n;
    let pending = yoroi?.pending ?? 0n;
    const pools: string[] = yoroi?.pools ? [...yoroi.pools] : [];
    for (const row of info) {
      ada += lovelace(row.utxo ?? row.total_balance);
      if (!yoroi) rewards += withdrawable(row);
      if (row.delegated_pool && !pools.includes(row.delegated_pool)) pools.push(row.delegated_pool);
    }
    const pool = pools[0];
    let ticker = pool ? pool.slice(0, 12) : "";
    if (pool) {
      try {
        const pinfo = (await koiosPost("pool_info", { _pool_bech32_ids: [pool] })) as Array<{
          meta_json?: { ticker?: string; name?: string };
        }>;
        ticker = pinfo[0]?.meta_json?.ticker || pinfo[0]?.meta_json?.name || ticker;
      } catch {
        /* keep id */
      }
    }
    let stakedSince: string | undefined;
    try {
      const updates = (await koiosPost("account_updates", { _stake_addresses: stakes })) as Array<{
        updates?: Array<{ action_type?: string; epoch_no?: number; block_time?: number }>;
        action_type?: string;
        epoch_no?: number;
        block_time?: number;
      }>;
      const flat = updates.flatMap((u) => u.updates ?? [u]);
      const del = [...flat].reverse().find((u) => (u.action_type || "").includes("delegat") || u.action_type === "registration");
      if (del?.block_time) stakedSince = `epoch ${del.epoch_no} · ${utc(del.block_time)}`;
      else if (del?.epoch_no) stakedSince = `epoch ${del.epoch_no}`;
    } catch {
      /* optional */
    }
    let epochNote = "取消委託後約 2 個 epoch（約 10 日）生效";
    try {
      const tip = (await koiosGet("tip")) as Array<{
        epoch_no?: number;
        epoch_slot?: number;
        block_time?: number;
      }>;
      const ep = tip[0]?.epoch_no;
      if (ep) epochNote = `當前 epoch ${ep} · 取消委託後約 2 個 epoch（約 10 日）生效`;
    } catch {
      /* keep default */
    }
    const q = await quoteAdaToken(undefined, true);
    const lines: StakeLine[] = [];
    if (pool && ada > 0n) {
      const n = Number(formatUnits(ada, 6));
      lines.push({
        id: `ada-stake-${stakes[0]}`,
        chainId: 1815,
        chain: "ADA",
        symbol: "ADA",
        name: ticker ? `委託 ${ticker}` : "Cardano 委託",
        icon: "/tokens/ada.png",
        amount: fmtAmt(ada, 6),
        raw: ada,
        contract: pool,
        side: "stake",
        extra: ticker || pool.slice(0, 16),
        quote: q,
        valueUsdc: q && Number.isFinite(n) ? n * q.usdc : null,
        status: "active",
        inWallet: true,
        stakedSince,
        unstakeNote: epochNote,
      });
    }
    if (rewards > 0n) {
      const n = Number(formatUnits(rewards, 6));
      lines.push({
        id: `ada-rew-${stakes[0]}`,
        chainId: 1815,
        chain: "ADA",
        symbol: "ADA",
        name: "未領取 ADA",
        icon: "/tokens/ada.png",
        amount: fmtAmt(rewards, 6),
        raw: rewards,
        side: "stake",
        extra: ticker ? `${ticker} 質押獎勵` : "質押獎勵",
        quote: q,
        valueUsdc: q && Number.isFinite(n) ? n * q.usdc : null,
        status: "claimable",
        inWallet: false,
        unstakeNote: "可在連接的 Cardano 錢包領取",
      });
    }
    if (pending > 0n) {
      const n = Number(formatUnits(pending, 6));
      lines.push({
        id: `ada-pending-${stakes[0]}`,
        chainId: 1815,
        chain: "ADA",
        symbol: "ADA",
        name: "待發放 ADA",
        icon: "/tokens/ada.png",
        amount: fmtAmt(pending, 6),
        raw: pending,
        side: "stake",
        extra: ticker ? `${ticker} 已賺取` : "已賺取",
        quote: q,
        valueUsdc: q && Number.isFinite(n) ? n * q.usdc : null,
        status: "unstaking",
        inWallet: false,
        unstakeNote: "約 2 個 epoch 後可領",
      });
    }
    return lines;
  } catch {
    return [];
  }
}
