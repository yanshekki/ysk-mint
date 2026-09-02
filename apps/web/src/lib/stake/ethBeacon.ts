import { formatUnits } from "viem";
import { accountCache } from "../defi/cache.ts";
import { explorerUrl } from "../evmDiscover.ts";
import { outboundFetch } from "../outbound.ts";
import i18n from "../i18n.ts";
import { fmtAmt, type StakeLine } from "./shared.ts";

const BEACON = ["https://ethereum-beacon-api.publicnode.com", "https://lodestar-mainnet.chainsafe.io"];
const PAGE_CAP = 12;
const ID_CAP = 200;
const BEACON_BATCH = 40;

type BsAddr = { hash?: string };
type BsDeposit = {
  amount?: string;
  pubkey?: string;
  status?: string;
  withdrawal_credentials?: string;
  withdrawal_address?: BsAddr | null;
  from_address?: BsAddr | null;
};
type BsWithdrawal = { validator_index?: number | string };
type BsPage<T> = { items?: T[]; next_page_params?: Record<string, unknown> | null };
type Tabs = { beacon_deposits_count?: number; withdrawals_count?: number };
type BeaconVal = {
  index?: string;
  balance?: string;
  status?: string;
  validator?: { pubkey?: string; withdrawal_credentials?: string };
};

async function httpJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = globalThis.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await outboundFetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

async function bsGet<T>(path: string, timeoutMs = 18000): Promise<T | null> {
  const base = explorerUrl(1);
  if (!base) return null;
  return httpJson<T>(`${base}${path}`, timeoutMs);
}

async function pageItems<T>(path: string, cap: number, timeoutMs: number): Promise<T[] | null> {
  const all: T[] = [];
  let query = "";
  let got = false;
  for (let i = 0; i < cap; i++) {
    const json = await bsGet<BsPage<T>>(`${path}${query}`, timeoutMs);
    if (!json) return got ? all : null;
    got = true;
    if (Array.isArray(json.items)) all.push(...json.items);
    const next = json.next_page_params;
    if (!next || !Object.keys(next).length) break;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) {
      if (v == null) continue;
      qs.set(k, String(v));
    }
    query = `?${qs.toString()}`;
  }
  return all;
}

function asWei(v: unknown): bigint {
  if (v == null || v === "") return 0n;
  try {
    const s = String(v);
    return BigInt(s.startsWith("0x") || s.startsWith("0X") ? s : s);
  } catch {
    return 0n;
  }
}

function normPk(raw?: string) {
  const s = (raw || "").toLowerCase();
  if (!/^0x[0-9a-f]{96}$/.test(s) && !/^[0-9a-f]{96}$/.test(s)) return "";
  return s.startsWith("0x") ? s : `0x${s}`;
}

function credPrefix(creds?: string) {
  const c = (creds || "").toLowerCase().replace(/^0x/, "");
  return c.slice(0, 2);
}

function credAddr(creds?: string) {
  const c = (creds || "").toLowerCase().replace(/^0x/, "");
  if (c.length !== 64) return "";
  if (c.startsWith("01") || c.startsWith("02")) return `0x${c.slice(24)}`;
  return "";
}

function ownsDeposit(user: string, d: BsDeposit) {
  const prefix = credPrefix(d.withdrawal_credentials);
  if (prefix === "00") return true;
  const wd = (d.withdrawal_address?.hash || credAddr(d.withdrawal_credentials)).toLowerCase();
  return wd === user;
}

function gweiToWei(gwei: string | undefined) {
  const n = asWei(gwei);
  return n * 10n ** 9n;
}

async function beaconByIds(ids: string[]): Promise<BeaconVal[] | null> {
  const out: BeaconVal[] = [];
  const uniq = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += BEACON_BATCH) {
    const part = uniq.slice(i, i + BEACON_BATCH);
    const q = part.map((id) => `id=${encodeURIComponent(id)}`).join("&");
    let batch: BeaconVal[] | null = null;
    for (const host of BEACON) {
      const json = await httpJson<{ data?: BeaconVal[] }>(`${host}/eth/v1/beacon/states/head/validators?${q}`, 16000);
      if (json && Array.isArray(json.data)) {
        batch = json.data;
        break;
      }
    }
    if (!batch) return null;
    out.push(...batch);
  }
  return out;
}

function stillOnBeacon(status?: string) {
  const s = (status || "").toLowerCase();
  if (!s) return false;
  if (s === "withdrawal_done") return false;
  return true;
}

function lineStatus(status?: string): StakeLine["status"] {
  const s = (status || "").toLowerCase();
  if (s.includes("exit") || s === "withdrawal_possible") return "unstaking";
  return "active";
}

export async function readEthBeaconStake(evm: string, ethUsd?: number | null): Promise<StakeLine[]> {
  if (!evm || !evm.startsWith("0x")) return [];
  return accountCache("pos.stake", 1, evm, "beacon", () => readEthBeaconStakeWork(evm, ethUsd));
}

async function readEthBeaconStakeWork(evm: string, ethUsd?: number | null): Promise<StakeLine[]> {
  const user = evm.toLowerCase();
  const tabs = await bsGet<Tabs>(`/api/v2/addresses/${user}/tabs-counters`, 12000);
  const depN = Number(tabs?.beacon_deposits_count ?? -1);
  const wdN = Number(tabs?.withdrawals_count ?? -1);
  if (tabs && depN === 0 && wdN === 0) return [];

  const wantDep = !tabs || depN > 0;
  const wantWd = !tabs || wdN > 0;
  const [deps, wds] = await Promise.all([
    wantDep ? pageItems<BsDeposit>(`/api/v2/addresses/${user}/beacon/deposits`, PAGE_CAP, 18000) : Promise.resolve([] as BsDeposit[]),
    wantWd ? pageItems<BsWithdrawal>(`/api/v2/addresses/${user}/withdrawals`, Math.min(8, PAGE_CAP), 16000) : Promise.resolve([] as BsWithdrawal[]),
  ]);
  if (deps == null && wds == null) return [];

  const pubkeys = new Set<string>();
  const pendingWei = new Map<string, bigint>();
  for (const d of deps ?? []) {
    if (!ownsDeposit(user, d)) continue;
    const pk = normPk(d.pubkey);
    if (!pk) continue;
    if ((d.status || "").toLowerCase() === "pending") {
      pendingWei.set(pk, (pendingWei.get(pk) ?? 0n) + asWei(d.amount));
    } else {
      pubkeys.add(pk);
    }
  }
  const indices: string[] = [];
  for (const w of wds ?? []) {
    const idx = w.validator_index;
    if (idx == null || idx === "") continue;
    const s = String(idx);
    if (!/^\d+$/.test(s)) continue;
    indices.push(s);
  }

  const ids = [...pubkeys, ...indices].slice(0, ID_CAP);
  const pendingOnly = [...pendingWei.keys()].filter((pk) => !pubkeys.has(pk)).slice(0, Math.max(0, ID_CAP - ids.length));
  const beacon =
    ids.length || pendingOnly.length ? await beaconByIds([...ids, ...pendingOnly]) : [];
  if (beacon == null && pendingWei.size === 0) return [];
  const beaconRows = beacon ?? [];

  const seen = new Set<string>();
  let active = 0n;
  let exiting = 0n;
  let nActive = 0;
  let nExit = 0;
  for (const v of beaconRows) {
    const pk = normPk(v.validator?.pubkey) || (v.index != null ? `i:${v.index}` : "");
    if (!pk || seen.has(pk)) continue;
    seen.add(pk);
    if (!stillOnBeacon(v.status)) continue;
    const wei = gweiToWei(v.balance);
    if (wei <= 0n) continue;
    pendingWei.delete(normPk(v.validator?.pubkey));
    if (lineStatus(v.status) === "unstaking") {
      exiting += wei;
      nExit += 1;
    } else {
      active += wei;
      nActive += 1;
    }
  }
  for (const [pk, wei] of pendingWei) {
    if (wei <= 0n) continue;
    if (seen.has(pk)) continue;
    active += wei;
    nActive += 1;
  }
  if (active <= 0n && exiting <= 0n) return [];

  const quote = ethUsd && ethUsd > 0 ? { usdc: ethUsd, source: "v2" as const } : null;
  const out: StakeLine[] = [];
  const push = (id: string, raw: bigint, n: number, status: StakeLine["status"], name: string, note: string) => {
    const amt = Number(formatUnits(raw, 18));
    out.push({
      id,
      chainId: 1,
      chain: "ETH",
      symbol: "ETH",
      name,
      icon: "/tokens/eth.png",
      amount: fmtAmt(raw, 18),
      raw,
      contract: `beacon:${user}`,
      side: "stake",
      extra: i18n.t("stake.ethBeaconN", { n }),
      quote,
      valueUsdc: quote && Number.isFinite(amt) ? amt * quote.usdc : null,
      status,
      inWallet: false,
      unstakeNote: note,
    });
  };
  if (active > 0n) {
    push(`eth-beacon-${user}`, active, nActive, "active", i18n.t("stake.ethBeacon"), i18n.t("stake.ethBeaconNote"));
  }
  if (exiting > 0n) {
    push(`eth-beacon-exit-${user}`, exiting, nExit, "unstaking", i18n.t("stake.ethBeaconExiting"), i18n.t("stake.ethBeaconNote"));
  }
  return out;
}
