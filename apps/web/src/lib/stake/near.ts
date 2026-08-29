import { formatUnits } from "viem";
import { accountCache } from "../defi/cache.ts";
import { nearView } from "../nearRpc.ts";
import { quoteNearToken } from "../nearDex.ts";
import { outboundFetch } from "../outbound.ts";
import { fmtAmt, type StakeLine } from "./shared.ts";
import i18n from "../i18n.ts";

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
    const res = await outboundFetch(`https://api.fastnear.com/v1/account/${account}/staking`);
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
          unstakeNote: i18n.t("stake.nearUnstakeWait"),
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
          unstakeNote: bal.canWithdraw ? i18n.t("stake.claimable") : i18n.t("stake.nearUnstaking"),
        });
      }
    }),
  );
  const liquidNote = i18n.t("stake.liquidNote");
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
