import { formatUnits } from "viem";
import { accountCache } from "../defi/cache.ts";
import { quoteAdaToken } from "../adaDex.ts";
import { koiosPost } from "../koios.ts";
import { outboundFetch } from "../outbound.ts";
import { fmtAmt, utc, type StakeLine, type StakeStatus } from "./shared.ts";
import i18n from "../i18n.ts";

/** Official Cardano NIGHT unit (policy + asset name `NIGHT`). */
export const NIGHT_UNIT = "0691b2fecca1ac4f53cb6dfb00b7013e561d1f34403b957cbb5af1fa4e49474854";
export const NIGHT_DECIMALS = 6;

const TGE = "https://mainnet.prod.gd.midnighttge.io";
const TGE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

type ThawRow = {
  amount?: number | string;
  status?: string;
  thawing_period_start?: string;
  transaction_id?: string | null;
};

type ThawSchedule = {
  numberOfClaimedAllocations?: number;
  thaws?: ThawRow[];
};

function starRaw(v: unknown): bigint {
  if (typeof v === "bigint") return v < 0n ? 0n : v;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return BigInt(Math.trunc(v));
  if (typeof v === "string" && v.trim()) {
    try {
      const n = BigInt(v.trim());
      return n < 0n ? 0n : n;
    } catch {
      return 0n;
    }
  }
  return 0n;
}

function asPayList(json: unknown): string[] {
  const out: string[] = [];
  const rows = Array.isArray(json) ? json : json && typeof json === "object" ? [json] : [];
  for (const row of rows as Array<Record<string, unknown>>) {
    if (typeof row.address === "string") out.push(row.address);
    if (Array.isArray(row.addresses)) {
      for (const a of row.addresses) if (typeof a === "string") out.push(a);
    }
  }
  return out;
}

function destAddrs(pays: string[], extra: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...pays, ...extra]) {
    const a = raw.trim();
    if (!a.startsWith("addr")) continue;
    if (seen.has(a)) continue;
    seen.add(a);
    out.push(a);
  }
  return out;
}

function tgeUrl(path: string) {
  if (typeof window === "undefined") return `${TGE}${path}`;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return `${TGE}${path}`;
  return `/tge${path}`;
}

function thawHeaders(): HeadersInit {
  const h: Record<string, string> = { accept: "application/json" };
  if (typeof window === "undefined") {
    h["user-agent"] = TGE_UA;
    h.origin = "https://redeem.midnight.gd";
    h.referer = "https://redeem.midnight.gd/";
  }
  return h;
}

async function fetchSchedule(addr: string): Promise<ThawRow[]> {
  try {
    const res = await outboundFetch(tgeUrl(`/thaws/${encodeURIComponent(addr)}/schedule`), { headers: thawHeaders() });
    const text = await res.text();
    if (!text.trim() || text.trimStart().startsWith("<")) return [];
    const json = JSON.parse(text) as ThawSchedule & { type?: string };
    if (res.status === 400 && json.type === "no_redeemable_thaws") return [];
    if (!res.ok) return [];
    return Array.isArray(json.thaws) ? json.thaws : [];
  } catch {
    return [];
  }
}

function kindOf(status: string): "frozen" | "claimable" | null {
  const s = status.toLowerCase();
  if (s === "upcoming" || s === "frozen" || s === "locked") return "frozen";
  if (s === "available" || s === "redeemable") return "claimable";
  return null;
}

function whenOf(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t <= 0) return iso;
  const abs = utc(t);
  const ms = t - Date.now();
  if (ms <= 0) return abs;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const left = d > 0 ? `${d}d ${h}h` : `${Math.max(1, h)}h`;
  return `${abs} · ${left}`;
}

type Bucket = { raw: bigint; nextIso: string };

function addThaw(into: Map<string, Bucket>, kind: "frozen" | "claimable", raw: bigint, iso: string) {
  if (raw <= 0n) return;
  const prev = into.get(kind);
  if (!prev) {
    into.set(kind, { raw, nextIso: iso });
    return;
  }
  prev.raw += raw;
  const a = Date.parse(iso);
  const b = Date.parse(prev.nextIso);
  if (Number.isFinite(a) && (!Number.isFinite(b) || a < b)) prev.nextIso = iso;
}

export async function readNightThaw(stakes: string[], pays: string[] = []): Promise<StakeLine[]> {
  const key = [...stakes, ...pays].filter(Boolean).join("|") || "none";
  return accountCache("pos.stake", 1815, key, "night", () => readNightThawWork(stakes, pays));
}

async function readNightThawWork(stakes: string[], pays: string[]): Promise<StakeLine[]> {
  const extra: string[] = [];
  const stakeKeys = [...new Set(stakes.map((s) => s.trim()).filter((s) => s.startsWith("stake")))];
  await Promise.all(
    stakeKeys.map(async (st) => {
      try {
        extra.push(...asPayList(await koiosPost("account_addresses", { _stake_addresses: [st] })));
      } catch {
        /* optional */
      }
    }),
  );
  const addrs = destAddrs(pays, extra);
  if (!addrs.length) return [];
  const buckets = new Map<string, Bucket>();
  await Promise.all(
    addrs.map(async (addr) => {
      const rows = await fetchSchedule(addr);
      for (const row of rows) {
        const kind = kindOf(row.status || "");
        if (!kind) continue;
        addThaw(buckets, kind, starRaw(row.amount), row.thawing_period_start || "");
      }
    }),
  );
  if (!buckets.size) return [];
  const q = await quoteAdaToken(NIGHT_UNIT);
  const lines: StakeLine[] = [];
  const push = (kind: "frozen" | "claimable", b: Bucket) => {
    const n = Number(formatUnits(b.raw, NIGHT_DECIMALS));
    const status: StakeStatus = kind === "claimable" ? "claimable" : "frozen";
    const note =
      kind === "claimable"
        ? i18n.t("stake.nightRedeem")
        : b.nextIso
          ? i18n.t("stake.nightThawAt", { when: whenOf(b.nextIso) })
          : i18n.t("stake.nightNote");
    lines.push({
      id: `night-thaw-${kind}`,
      chainId: 1815,
      chain: "ADA",
      symbol: "NIGHT",
      name: kind === "claimable" ? i18n.t("stake.nightRedeemable") : i18n.t("stake.nightFrozen"),
      icon: "/tokens/night.png",
      amount: fmtAmt(b.raw, NIGHT_DECIMALS),
      raw: b.raw,
      decimals: NIGHT_DECIMALS,
      contract: NIGHT_UNIT,
      side: "stake",
      extra: i18n.t("stake.nightNote"),
      quote: q,
      valueUsdc: q && Number.isFinite(n) ? n * q.usdc : null,
      status,
      inWallet: false,
      unstakeNote: note,
    });
  };
  const frozen = buckets.get("frozen");
  const claim = buckets.get("claimable");
  if (frozen) push("frozen", frozen);
  if (claim) push("claimable", claim);
  return lines;
}
