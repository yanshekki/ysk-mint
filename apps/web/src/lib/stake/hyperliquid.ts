import { accountCache } from "../defi/cache.ts";
import { rpcOutboundFetch, rpcTry } from "../rpcPool.ts";
import i18n from "../i18n.ts";
import { fmtNum, utc, type StakeLine } from "./shared.ts";

type PerpPos = {
  position?: {
    coin?: string;
    szi?: string;
    positionValue?: string;
    unrealizedPnl?: string;
    leverage?: { value?: number; type?: string };
  };
};
type Clearing = {
  marginSummary?: { accountValue?: string; totalNtlPos?: string; totalMarginUsed?: string };
  withdrawable?: string;
  assetPositions?: PerpPos[];
};
type VaultEq = { vaultAddress?: string; equity?: string; lockedUntilTimestamp?: number };
type Sub = { name?: string; subAccountUser?: string; clearinghouseState?: Clearing };

async function hlInfo<T>(body: unknown): Promise<T | null> {
  try {
    return await rpcTry(998, async (url, signal) => {
      const r = await rpcOutboundFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<T>;
    });
  } catch {
    return null;
  }
}

function asUsd(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function usdLine(
  id: string,
  name: string,
  usd: number,
  extra: string | undefined,
  status: StakeLine["status"],
  note: string,
  contract?: string,
): StakeLine {
  const raw = BigInt(Math.round(usd * 1e6));
  return {
    id,
    chainId: 998,
    chain: "HyperCore",
    symbol: "USD",
    name,
    icon: "/tokens/hype.png",
    amount: fmtNum(usd),
    raw,
    contract,
    side: "stake",
    extra,
    quote: { usdc: 1, source: "v2" },
    valueUsdc: usd,
    status,
    inWallet: false,
    unstakeNote: note,
  };
}

function perpLines(user: string, state: Clearing | null | undefined, tag: string): StakeLine[] {
  if (!state) return [];
  const usd = asUsd(state.marginSummary?.accountValue);
  if (!(usd > 0)) return [];
  const n = (state.assetPositions ?? []).filter((p) => Number(p.position?.szi || 0) !== 0).length;
  const extra = n ? i18n.t("stake.hyperPerpsN", { n }) : undefined;
  return [
    usdLine(
      `hl-perp-${tag}-${user}`,
      tag === "master" ? i18n.t("stake.hyperPerps") : i18n.t("stake.hyperSub", { name: tag }),
      usd,
      extra,
      "active",
      i18n.t("stake.hyperPerpsNote"),
      user,
    ),
  ];
}

export async function readHyperliquidDesk(user: string): Promise<StakeLine[]> {
  if (!user || !user.startsWith("0x")) return [];
  return accountCache("pos.stake", 998, user, "hl-desk", () => readHyperliquidDeskWork(user));
}

async function readHyperliquidDeskWork(user: string): Promise<StakeLine[]> {
  const addr = user.toLowerCase();
  const [perps, vaults, subs] = await Promise.all([
    hlInfo<Clearing>({ type: "clearinghouseState", user: addr }),
    hlInfo<VaultEq[]>({ type: "userVaultEquities", user: addr }),
    hlInfo<Sub[]>({ type: "subAccounts", user: addr }),
  ]);
  const out: StakeLine[] = [];
  out.push(...perpLines(addr, perps, "master"));
  for (const v of vaults ?? []) {
    const usd = asUsd(v.equity);
    if (!(usd > 0) || !v.vaultAddress) continue;
    const locked = Number(v.lockedUntilTimestamp || 0);
    const note =
      locked && locked > Date.now() ? i18n.t("stake.hyperVaultUntil", { when: utc(locked) }) : i18n.t("stake.hyperVaultNote");
    out.push(
      usdLine(
        `hl-vault-${addr}-${v.vaultAddress}`,
        i18n.t("stake.hyperVault"),
        usd,
        v.vaultAddress.slice(0, 10),
        locked && locked > Date.now() ? "unstaking" : "active",
        note,
        v.vaultAddress,
      ),
    );
  }
  for (const s of subs ?? []) {
    const sub = (s.subAccountUser || "").toLowerCase();
    if (!sub) continue;
    out.push(...perpLines(sub, s.clearinghouseState, s.name || sub.slice(0, 8)));
  }
  return out;
}
