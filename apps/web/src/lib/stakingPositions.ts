import { formatUnits, type Address, type PublicClient } from "viem";
import { accountCache } from "./defi/cache.ts";
import { LST } from "./defiAddresses.ts";
import { type Quote } from "./defiQuotes.ts";
import { nearView } from "./nearRpc.ts";
import type { AaveCard, ProtocolLine } from "./defiPositions.ts";
import { quoteNearToken } from "./nearDex.ts";
import { quoteAdaToken } from "./adaDex.ts";
import { addressToHex, hexToBech32, stakeFromPayment } from "./cardanoCip30.ts";
import { koiosPost } from "./koios.ts";

export type StakeStatus = "liquid" | "active" | "unstaking" | "claimable";

export type StakeLine = ProtocolLine & {
  status: StakeStatus;
  inWallet?: boolean;
  stakedSince?: string;
  unstakeNote?: string;
};

const LIDO_WQ = "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1" as Address;

const lidoWqAbi = [
  { type: "function", name: "getWithdrawalRequests", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256[]" }] },
  {
    type: "function",
    name: "getWithdrawalStatus",
    stateMutability: "view",
    inputs: [{ type: "uint256[]" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "amountOfStETH", type: "uint256" },
          { name: "amountOfShares", type: "uint256" },
          { name: "owner", type: "address" },
          { name: "timestamp", type: "uint256" },
          { name: "isFinalized", type: "bool" },
          { name: "isClaimed", type: "bool" },
        ],
      },
    ],
  },
] as const;

const SOL_STAKE = "Stake11111111111111111111111111111111111111";
const SOL_RPCS = [
  "https://solana.leorpc.com/?api_key=FREE",
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
];

export const SOL_LST: Record<string, { symbol: string; name: string; icon: string }> = {
  msolzycxhdygdzu16g5qsh3i5k3z3kzk7ytfqcjm7so: { symbol: "mSOL", name: "Marinade mSOL", icon: "/tokens/sol.png" },
  j1toso1uck3rlmjorhttrvwy9hj7x8v9yyac6y7kgcpn: { symbol: "jitoSOL", name: "Jito SOL", icon: "/tokens/sol.png" },
  bso13r4tkie4kuml71lshtppl2euvfxqecgmod7hgak: { symbol: "bSOL", name: "Blaze bSOL", icon: "/tokens/sol.png" },
};

function utc(ts: number) {
  if (!Number.isFinite(ts) || ts <= 0) return "";
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function fmtAmt(raw: bigint, decimals: number) {
  const n = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(n)) return formatUnits(raw, decimals);
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function lstStakeLines(
  chainId: number,
  rows: Array<{ id: string; symbol: string; name: string; icon: string; amount: string; raw: bigint; contract?: string }>,
  quotes: Map<string, Quote>,
  liquidNote: string,
): StakeLine[] {
  const map = { ...(LST[chainId] ?? {}) };
  if (chainId === 101) {
    for (const [k, v] of Object.entries(SOL_LST)) {
      map[k] = { symbol: v.symbol, name: v.name, decimals: 9, icon: v.icon };
    }
  }
  if (!Object.keys(map).length) return [];
  const short = chainId === 1 ? "ETH" : chainId === 8453 ? "Base" : chainId === 42161 ? "Arb" : chainId === 397 ? "NEAR" : chainId === 101 ? "SOL" : chainId === 43114 ? "AVAX" : chainId === 56 ? "BNB" : String(chainId);
  const lines: StakeLine[] = [];
  for (const r of rows) {
    if (!r.contract || r.raw === 0n) continue;
    const meta = map[r.contract.toLowerCase()];
    if (!meta) continue;
    const q = quotes.get(`${chainId}:${r.contract.toLowerCase()}`) ?? quotes.get(`${chainId}:native`);
    const n = Number(r.amount.replace(/,/g, ""));
    lines.push({
      id: `lst-${r.id}`,
      chainId,
      chain: short,
      symbol: r.symbol,
      name: meta.name,
      icon: r.icon || meta.icon,
      amount: r.amount,
      raw: r.raw,
      contract: r.contract,
      side: "stake",
      extra: meta.name,
      quote: q ?? null,
      valueUsdc: q && Number.isFinite(n) ? n * q.usdc : null,
      status: "liquid",
      inWallet: true,
      unstakeNote: liquidNote,
    });
  }
  return lines;
}

export async function readLidoQueue(client: PublicClient, user: Address, ethUsd?: number | null): Promise<StakeLine[]> {
  return accountCache("pos.stake", 1, user, "lido-wq", () => readLidoQueueWork(client, user, ethUsd));
}

async function readLidoQueueWork(client: PublicClient, user: Address, ethUsd?: number | null): Promise<StakeLine[]> {
  try {
    const ids = await client.readContract({ address: LIDO_WQ, abi: lidoWqAbi, functionName: "getWithdrawalRequests", args: [user] });
    if (!ids.length) return [];
    const statuses = await client.readContract({ address: LIDO_WQ, abi: lidoWqAbi, functionName: "getWithdrawalStatus", args: [ids] });
    const out: StakeLine[] = [];
    statuses.forEach((s, i) => {
      if (s.isClaimed) return;
      const n = Number(formatUnits(s.amountOfStETH, 18));
      const ts = Number(s.timestamp);
      const status: StakeStatus = s.isFinalized ? "claimable" : "unstaking";
      out.push({
        id: `lido-q-${ids[i].toString()}`,
        chainId: 1,
        chain: "ETH",
        symbol: "stETH",
        name: "Lido 提款隊列",
        icon: "/tokens/eth.png",
        amount: fmtAmt(s.amountOfStETH, 18),
        raw: s.amountOfStETH,
        contract: LIDO_WQ,
        side: "stake",
        extra: `#${ids[i].toString()}`,
        quote: ethUsd ? { usdc: ethUsd, source: "v3" } : null,
        valueUsdc: ethUsd && Number.isFinite(n) ? n * ethUsd : null,
        status,
        inWallet: false,
        stakedSince: ts ? utc(ts) : undefined,
        unstakeNote: s.isFinalized ? "可領 ETH" : "隊列中，尚未 finalized",
      });
    });
    return out;
  } catch {
    return [];
  }
}

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
    const res = await fetch("https://iohk-mainnet.yoroiwallet.com/api/account/state", {
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
      const tip = (await fetch("https://api.koios.rest/api/v1/tip").then((r) => r.json())) as Array<{
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

const NEAR_POOL_SEEDS = [
  "here.poolv1.near",
  "everstake.poolv1.near",
  "astro-stakers.poolv1.near",
  "zavodil.poolv1.near",
  "legend.poolv1.near",
  "masternode.poolv1.near",
  "aurora.pool.near",
  "staked.poolv1.near",
  "bisontrails.poolv1.near",
  "figment.poolv1.near",
  "lunanova.poolv1.near",
  "tribe.poolv1.near",
  "crypto-crew.poolv1.near",
  "near-pool.poolv1.near",
  "hashquark.poolv1.near",
];

function asU128(v: unknown): bigint {
  if (v == null) return 0n;
  if (typeof v === "string" || typeof v === "number") return BigInt(v);
  if (typeof v === "object" && v && "0" in (v as object)) return BigInt(String((v as { 0: string })[0]));
  return 0n;
}

async function nearPoolBalances(pool: string, account: string) {
  try {
    const acc = await nearView<{
      staked_balance?: unknown;
      unstaked_balance?: unknown;
      can_withdraw?: boolean;
    }>(pool, "get_account", { account_id: account });
    return {
      staked: asU128(acc.staked_balance),
      unstaked: asU128(acc.unstaked_balance),
      canWithdraw: Boolean(acc.can_withdraw),
    };
  } catch {
    try {
      const [staked, unstaked, can] = await Promise.all([
        nearView<unknown>(pool, "get_account_staked_balance", { account_id: account }),
        nearView<unknown>(pool, "get_account_unstaked_balance", { account_id: account }),
        nearView<boolean>(pool, "is_account_unstaked_balance_available", { account_id: account }).catch(() => false),
      ]);
      return { staked: asU128(staked), unstaked: asU128(unstaked), canWithdraw: Boolean(can) };
    } catch {
      return null;
    }
  }
}

async function nearFtBalance(contract: string, account: string) {
  try {
    const raw = await nearView<string>(contract, "ft_balance_of", { account_id: account });
    return asU128(String(raw).replace(/"/g, ""));
  } catch {
    return 0n;
  }
}

export async function readNearStake(account: string): Promise<StakeLine[]> {
  if (!account) return [];
  return accountCache("pos.stake", 397, account, "near", () => readNearStakeWork(account));
}

async function readNearStakeWork(account: string): Promise<StakeLine[]> {
  const found = new Set(NEAR_POOL_SEEDS);
  try {
    const res = await fetch(`https://api.fastnear.com/v1/account/${account}/staking`);
    if (res.ok) {
      const json = (await res.json()) as { pools?: Array<{ pool_id?: string }> };
      for (const p of json.pools ?? []) if (p.pool_id) found.add(p.pool_id);
    }
  } catch {
    /* CORS or indexer miss — still query seeds */
  }
  const q = await quoteNearToken(undefined, true);
  const out: StakeLine[] = [];
  const minNear = 10n ** 21n;
  await Promise.all(
    [...found].map(async (pool) => {
      const bal = await nearPoolBalances(pool, account);
      if (!bal) return;
      const name = pool.replace(".poolv1.near", "").replace(".pool.near", "");
      if (bal.staked >= minNear) {
        const n = Number(formatUnits(bal.staked, 24));
        out.push({
          id: `near-stk-${pool}`,
          chainId: 397,
          chain: "NEAR",
          symbol: "NEAR",
          name,
          icon: "/tokens/near.png",
          amount: fmtAmt(bal.staked, 24),
          raw: bal.staked,
          contract: pool,
          side: "stake",
          extra: pool,
          quote: q,
          valueUsdc: q && Number.isFinite(n) ? n * q.usdc : null,
          status: "active",
          inWallet: false,
          unstakeNote: "解押後約 4 個 epoch（約 2 日）可領",
        });
      }
      if (bal.unstaked >= minNear) {
        const n = Number(formatUnits(bal.unstaked, 24));
        out.push({
          id: `near-unstk-${pool}`,
          chainId: 397,
          chain: "NEAR",
          symbol: "NEAR",
          name,
          icon: "/tokens/near.png",
          amount: fmtAmt(bal.unstaked, 24),
          raw: bal.unstaked,
          contract: pool,
          side: "stake",
          extra: pool,
          quote: q,
          valueUsdc: q && Number.isFinite(n) ? n * q.usdc : null,
          status: bal.canWithdraw ? "claimable" : "unstaking",
          inWallet: false,
          unstakeNote: bal.canWithdraw ? "可領" : "解押中，約 4 個 epoch 後可領",
        });
      }
    }),
  );
  const liquidNote = "流動性質押，可隨時經協議兌換。首次質押時間不在本站。";
  for (const [id, meta] of [
    ["linear-protocol.near", { symbol: "LINEAR", name: "LiNEAR" }],
    ["meta-pool.near", { symbol: "stNEAR", name: "Meta Pool stNEAR" }],
  ] as const) {
    const raw = await nearFtBalance(id, account);
    if (raw < minNear) continue;
    const n = Number(formatUnits(raw, 24));
    const lq = await quoteNearToken(id, false);
    out.push({
      id: `near-lst-${id}`,
      chainId: 397,
      chain: "NEAR",
      symbol: meta.symbol,
      name: meta.name,
      icon: "/tokens/near.png",
      amount: fmtAmt(raw, 24),
      raw,
      contract: id,
      side: "stake",
      extra: meta.name,
      quote: lq,
      valueUsdc: lq && Number.isFinite(n) ? n * lq.usdc : q && Number.isFinite(n) ? n * q.usdc : null,
      status: "liquid",
      inWallet: true,
      unstakeNote: liquidNote,
    });
  }
  return out;
}

async function solRpc(method: string, params: unknown[]) {
  for (const url of SOL_RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { result?: unknown; error?: unknown };
      if (json.error) continue;
      return json.result;
    } catch {
      /* next */
    }
  }
  return null;
}

export async function readSolStake(pubkey: string, solUsd?: number | null): Promise<StakeLine[]> {
  if (!pubkey) return [];
  return accountCache("pos.stake", 101, pubkey, "sol", () => readSolStakeWork(pubkey, solUsd));
}

async function readSolStakeWork(pubkey: string, solUsd?: number | null): Promise<StakeLine[]> {
  const parsed = await solRpc("getProgramAccounts", [
    SOL_STAKE,
    { encoding: "jsonParsed", filters: [{ memcmp: { offset: 12, bytes: pubkey } }] },
  ]);
  const list = Array.isArray(parsed) ? parsed : [];
  const epochInfo = (await solRpc("getEpochInfo", [])) as { epoch?: number; slotIndex?: number; slotsInEpoch?: number } | null;
  const epoch = epochInfo?.epoch ?? 0;
  const remainSlots = (epochInfo?.slotsInEpoch ?? 0) - (epochInfo?.slotIndex ?? 0);
  const remainHrs = remainSlots > 0 ? Math.round((remainSlots * 0.4) / 3600) : 0;
  const out: StakeLine[] = [];
  for (const item of list) {
    const pk = (item as { pubkey?: string }).pubkey || "";
    const info = (item as { account?: { data?: { parsed?: { info?: Record<string, unknown> } } } }).account?.data?.parsed?.info;
    const stake = info?.stake as { delegation?: { stake?: string; activationEpoch?: string; deactivationEpoch?: string; voter?: string } } | undefined;
    const del = stake?.delegation;
    const lamports = BigInt(del?.stake || (item as { account?: { lamports?: number } }).account?.lamports || 0);
    if (lamports === 0n) continue;
    const act = Number(del?.activationEpoch ?? 0);
    const deact = Number(del?.deactivationEpoch ?? 0);
    const deactivating = Number.isFinite(deact) && deact < 1e18;
    const n = Number(formatUnits(lamports, 9));
    let status: StakeStatus = "active";
    let unstakeNote = `解除委託後下個 epoch 生效（本 epoch ${epoch}${remainHrs ? `，約 ${remainHrs} 小時結束` : ""}）`;
    if (deactivating) {
      status = deact <= epoch ? "claimable" : "unstaking";
      unstakeNote = deact <= epoch ? "可領" : `解押中，deactivation epoch ${deact}`;
    }
    out.push({
      id: `sol-stk-${pk}`,
      chainId: 101,
      chain: "SOL",
      symbol: "SOL",
      name: "Stake account",
      icon: "/tokens/sol.png",
      amount: fmtAmt(lamports, 9),
      raw: lamports,
      contract: pk,
      side: "stake",
      extra: del?.voter ? String(del.voter).slice(0, 8) : pk.slice(0, 8),
      quote: solUsd ? { usdc: solUsd, source: "jup" } : null,
      valueUsdc: solUsd && Number.isFinite(n) ? n * solUsd : null,
      status,
      inWallet: false,
      stakedSince: act ? `epoch ${act}` : undefined,
      unstakeNote,
    });
  }
  return out;
}

export function stakeSubtitle(l: StakeLine) {
  return [l.extra, l.stakedSince ? `質押自 ${l.stakedSince}` : "", l.unstakeNote].filter(Boolean).join(" · ");
}

export function stakeBadge(l: StakeLine) {
  if (l.status === "claimable") return "可領";
  if (l.status === "unstaking") return "解押中";
  if (l.status === "active") return "委託中";
  return "流動";
}

const erc20Bal = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const SAVAX = "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE" as Address;
const BENQI_LP = "0x784DA19e61cf348a8c54547531795ECfee2AfFd1" as Address;

const savaxAbi = [
  ...erc20Bal,
  { type: "function", name: "getPooledAvaxByShares", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getUnlockRequestCount", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "getPaginatedUnlockRequests",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "startedAt", type: "uint256" },
          { name: "shareAmount", type: "uint256" },
        ],
      },
      { type: "uint256[]" },
    ],
  },
  { type: "function", name: "cooldownPeriod", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "redeemPeriod", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const qiSnapAbi = [
  ...erc20Bal,
  {
    type: "function",
    name: "getAccountSnapshot",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
  },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

const chefAbi = [
  { type: "function", name: "poolLength", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "userInfo",
    stateMutability: "view",
    inputs: [{ type: "uint256" }, { type: "address" }],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },
] as const;

const BENQI_QI: Array<{ token: Address; symbol: string; underlying: string; dec: number }> = [
  { token: "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c", symbol: "AVAX", underlying: "avax", dec: 18 },
  { token: "0xF362feA9659cf036792c9cb02f8ff8198E21B4cB", symbol: "sAVAX", underlying: "savax", dec: 18 },
  { token: "0xBEb5d47A3f720Ec0a390d04b4d41ED7d9688bC7F", symbol: "USDC", underlying: "usd", dec: 6 },
  { token: "0xc9e5999b8e75C3fEB117F6f73E664b9f3C8ca65C", symbol: "USDT.e", underlying: "usd", dec: 6 },
  { token: "0xB715808a78F6041E46d61Cb123C9B4A27056AE9C", symbol: "USDC", underlying: "usd", dec: 6 },
  { token: "0xd8fcDa6ec4Bdc547C0827B8804e89aCd817d56EF", symbol: "USDT", underlying: "usd", dec: 6 },
  { token: "0x835866d37AFB8CB8F8334dCCdaf66cf01832Ff5D", symbol: "DAI", underlying: "usd", dec: 18 },
];

export async function readPinnedLst(client: PublicClient, chainId: number, user: Address, quotes: Map<string, Quote>, liquidNote: string): Promise<StakeLine[]> {
  return accountCache("pos.stake", chainId, user, "lst", () => readPinnedLstWork(client, chainId, user, quotes, liquidNote));
}

async function readPinnedLstWork(client: PublicClient, chainId: number, user: Address, quotes: Map<string, Quote>, liquidNote: string): Promise<StakeLine[]> {
  const map = LST[chainId];
  if (!map) return [];
  const short = chainId === 1 ? "ETH" : chainId === 8453 ? "Base" : chainId === 42161 ? "Arb" : chainId === 43114 ? "AVAX" : chainId === 56 ? "BNB" : String(chainId);
  const out: StakeLine[] = [];
  await Promise.all(
    Object.entries(map).map(async ([addr, meta]) => {
      if (!addr.startsWith("0x")) return;
      try {
        const raw = await client.readContract({ address: addr as Address, abi: erc20Bal, functionName: "balanceOf", args: [user] });
        if (raw === 0n) return;
        const n = Number(formatUnits(raw, meta.decimals));
        let q = quotes.get(`${chainId}:${addr}`) ?? quotes.get(`${chainId}:native`);
        if (addr.toLowerCase() === SAVAX.toLowerCase()) {
          try {
            const pooled = await client.readContract({ address: SAVAX, abi: savaxAbi, functionName: "getPooledAvaxByShares", args: [raw] });
            const avax = Number(formatUnits(pooled, 18));
            const avaxUsd = quotes.get("43114:native")?.usdc;
            if (avaxUsd && Number.isFinite(avax) && avax > 0) q = { usdc: (avax / n) * avaxUsd, source: "v2" };
          } catch {
            /* keep native */
          }
        }
        out.push({
          id: `lst-pin-${chainId}-${addr}`,
          chainId,
          chain: short,
          symbol: meta.symbol,
          name: meta.name,
          icon: meta.icon,
          amount: fmtAmt(raw, meta.decimals),
          raw,
          contract: addr,
          side: "stake",
          extra: meta.name,
          quote: q ?? null,
          valueUsdc: q && Number.isFinite(n) ? n * q.usdc : null,
          status: "liquid",
          inWallet: true,
          unstakeNote: addr.toLowerCase() === SAVAX.toLowerCase() ? "解押冷卻 15 日，其後 2 日可領。首次質押時間不在本站。" : liquidNote,
        });
      } catch {
        /* skip */
      }
    }),
  );
  return out;
}

export async function readSavaxUnlocks(client: PublicClient, user: Address, avaxUsd?: number | null): Promise<StakeLine[]> {
  return accountCache("pos.stake", 43114, user, "savax", () => readSavaxUnlocksWork(client, user, avaxUsd));
}

async function readSavaxUnlocksWork(client: PublicClient, user: Address, avaxUsd?: number | null): Promise<StakeLine[]> {
  try {
    const count = await client.readContract({ address: SAVAX, abi: savaxAbi, functionName: "getUnlockRequestCount", args: [user] });
    if (count === 0n) return [];
    const n = Number(count);
    const [reqs, avaxAmts] = await client.readContract({
      address: SAVAX,
      abi: savaxAbi,
      functionName: "getPaginatedUnlockRequests",
      args: [user, 0n, BigInt(n)],
    });
    const cool = Number(await client.readContract({ address: SAVAX, abi: savaxAbi, functionName: "cooldownPeriod" }));
    const redeem = Number(await client.readContract({ address: SAVAX, abi: savaxAbi, functionName: "redeemPeriod" }));
    const now = Date.now() / 1000;
    const out: StakeLine[] = [];
    reqs.forEach((r, i) => {
      const start = Number(r.startedAt);
      const shares = r.shareAmount;
      if (shares === 0n) return;
      const coolEnd = start + cool;
      const redeemEnd = coolEnd + redeem;
      let status: StakeStatus = "unstaking";
      let note = `冷卻至 ${utc(coolEnd)}，其後至 ${utc(redeemEnd)} 可領`;
      if (now >= coolEnd && now <= redeemEnd) {
        status = "claimable";
        note = `可領，窗口至 ${utc(redeemEnd)}`;
      } else if (now > redeemEnd) {
        note = "領取窗口已過，須重新申請";
      }
      const avaxRaw = avaxAmts[i] ?? 0n;
      const avaxN = Number(formatUnits(avaxRaw || shares, 18));
      out.push({
        id: `savax-unlock-${i}-${start}`,
        chainId: 43114,
        chain: "AVAX",
        symbol: "sAVAX",
        name: "BENQI 解押",
        icon: "/tokens/avax.png",
        amount: fmtAmt(shares, 18),
        raw: shares,
        contract: SAVAX,
        side: "stake",
        extra: `#${i}`,
        quote: avaxUsd ? { usdc: avaxUsd, source: "v2" } : null,
        valueUsdc: avaxUsd && Number.isFinite(avaxN) ? avaxN * avaxUsd : null,
        status,
        inWallet: false,
        stakedSince: utc(start),
        unstakeNote: note,
      });
    });
    return out;
  } catch {
    return [];
  }
}

export async function readBenqiMarkets(client: PublicClient, user: Address, quotes: Map<string, Quote>): Promise<AaveCard | null> {
  return accountCache("pos.lend", 43114, user, "benqi", () => readBenqiMarketsWork(client, user, quotes));
}

async function readBenqiMarketsWork(client: PublicClient, user: Address, quotes: Map<string, Quote>): Promise<AaveCard | null> {
  const avaxUsd = quotes.get("43114:native")?.usdc;
  const savaxQ = quotes.get(`43114:${SAVAX.toLowerCase()}`);
  const lines: ProtocolLine[] = [];
  const tokens = new Set<string>();
  await Promise.all(
    BENQI_QI.map(async (m) => {
      try {
        const snap = await client.readContract({ address: m.token, abi: qiSnapAbi, functionName: "getAccountSnapshot", args: [user] });
        const qiBal = snap[1];
        const borrow = snap[2];
        const rate = snap[3];
        tokens.add(m.token.toLowerCase());
        const und = qiBal === 0n ? 0n : (qiBal * rate) / 10n ** 18n;
        const push = (raw: bigint, side: "supply" | "borrow") => {
          if (raw === 0n) return;
          const n = Number(formatUnits(raw, m.dec));
          const q =
            m.underlying === "usd"
              ? { usdc: 1, source: "stable" as const }
              : m.underlying === "savax"
                ? savaxQ
                : avaxUsd
                  ? { usdc: avaxUsd, source: "v2" as const }
                  : null;
          lines.push({
            id: `benqi-${side}-${m.token}`,
            chainId: 43114,
            chain: "AVAX",
            symbol: m.symbol,
            name: m.symbol,
            icon: "/tokens/avax.png",
            amount: fmtAmt(raw, m.dec),
            raw,
            contract: m.token,
            side,
            quote: q ?? null,
            valueUsdc: q && Number.isFinite(n) ? n * q.usdc : null,
          });
        };
        push(und, "supply");
        push(borrow, "borrow");
      } catch {
        /* market miss */
      }
    }),
  );
  try {
    const len = await client.readContract({ address: BENQI_LP, abi: chefAbi, functionName: "poolLength" });
    const n = Math.min(Number(len), 16);
    for (let i = 0; i < n; i++) {
      const info = await client.readContract({ address: BENQI_LP, abi: chefAbi, functionName: "userInfo", args: [BigInt(i), user] });
      const amt = info[0];
      if (amt === 0n) continue;
      lines.push({
        id: `benqi-lp-${i}`,
        chainId: 43114,
        chain: "AVAX",
        symbol: "LP",
        name: `BENQI LP #${i}`,
        icon: "/tokens/avax.png",
        amount: fmtAmt(amt, 18),
        raw: amt,
        contract: BENQI_LP,
        side: "lp",
        extra: "LP 質押，可隨時退出（協議）",
      });
    }
  } catch {
    /* no chef */
  }
  if (!lines.length) return null;
  return { chainId: 43114, chain: "AVAX", health: "—", lines, aTokens: tokens };
}
