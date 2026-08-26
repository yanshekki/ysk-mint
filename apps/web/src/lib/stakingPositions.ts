import { formatUnits, type Address, type PublicClient } from "viem";
import { LST } from "./defiAddresses.ts";
import { type Quote } from "./defiQuotes.ts";
import { nearView } from "./nearRpc.ts";
import type { ProtocolLine } from "./defiPositions.ts";
import { quoteNearToken } from "./nearDex.ts";
import { quoteAdaToken } from "./adaDex.ts";

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

async function koiosPost(path: string, body: unknown) {
  const res = await fetch(`https://api.koios.rest/api/v1/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`koios ${path}`);
  return res.json() as Promise<unknown>;
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
  const short = chainId === 1 ? "ETH" : chainId === 8453 ? "Base" : chainId === 42161 ? "Arb" : chainId === 397 ? "NEAR" : chainId === 101 ? "SOL" : String(chainId);
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

export async function readAdaStake(stakeAddr: string): Promise<StakeLine[]> {
  if (!stakeAddr.startsWith("stake")) return [];
  try {
    const info = (await koiosPost("account_info", { _stake_addresses: [stakeAddr] })) as Array<{
      status?: string;
      delegated_pool?: string;
      total_balance?: string;
      utxo?: string;
      rewards_available?: string;
    }>;
    const row = info[0];
    if (!row) return [];
    const pool = row.delegated_pool;
    if (!pool && row.status !== "registered") return [];
    const ada = BigInt(row.utxo ?? row.total_balance ?? "0");
    const rewards = BigInt(row.rewards_available ?? "0");
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
      const updates = (await koiosPost("account_updates", { _stake_addresses: [stakeAddr] })) as Array<{
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
        id: `ada-stake-${stakeAddr}`,
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
        id: `ada-rew-${stakeAddr}`,
        chainId: 1815,
        chain: "ADA",
        symbol: "ADA",
        name: "未領取質押獎勵",
        icon: "/tokens/ada.png",
        amount: fmtAmt(rewards, 6),
        raw: rewards,
        side: "stake",
        extra: "rewards_available",
        quote: q,
        valueUsdc: q && Number.isFinite(n) ? n * q.usdc : null,
        status: "claimable",
        inWallet: false,
        unstakeNote: "可在錢包領取",
      });
    }
    return lines;
  } catch {
    return [];
  }
}

export async function readNearStake(account: string): Promise<StakeLine[]> {
  if (!account) return [];
  try {
    const res = await fetch(`https://api.fastnear.com/v1/account/${account}/staking`);
    if (!res.ok) return [];
    const json = (await res.json()) as { pools?: Array<{ pool_id?: string }> };
    const pools = [...new Set((json.pools ?? []).map((p) => p.pool_id).filter((x): x is string => Boolean(x)))];
    const q = await quoteNearToken(undefined, true);
    const out: StakeLine[] = [];
    await Promise.all(
      pools.map(async (pool) => {
        try {
          const acc = await nearView<{
            staked_balance?: string;
            unstaked_balance?: string;
            can_withdraw?: boolean;
          }>(pool, "get_account", { account_id: account });
          const staked = BigInt(acc.staked_balance || "0");
          const unstaked = BigInt(acc.unstaked_balance || "0");
          const minNear = 10n ** 21n;
          const name = pool.replace(".poolv1.near", "").replace(".pool.near", "");
          if (staked >= minNear) {
            const n = Number(formatUnits(staked, 24));
            out.push({
              id: `near-stk-${pool}`,
              chainId: 397,
              chain: "NEAR",
              symbol: "NEAR",
              name: name,
              icon: "/tokens/near.png",
              amount: fmtAmt(staked, 24),
              raw: staked,
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
          if (unstaked >= minNear) {
            const n = Number(formatUnits(unstaked, 24));
            const ready = Boolean(acc.can_withdraw);
            out.push({
              id: `near-unstk-${pool}`,
              chainId: 397,
              chain: "NEAR",
              symbol: "NEAR",
              name: name,
              icon: "/tokens/near.png",
              amount: fmtAmt(unstaked, 24),
              raw: unstaked,
              contract: pool,
              side: "stake",
              extra: pool,
              quote: q,
              valueUsdc: q && Number.isFinite(n) ? n * q.usdc : null,
              status: ready ? "claimable" : "unstaking",
              inWallet: false,
              unstakeNote: ready ? "可領" : "解押中，約 4 個 epoch 後可領",
            });
          }
        } catch {
          /* pool miss */
        }
      }),
    );
    return out;
  } catch {
    return [];
  }
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
