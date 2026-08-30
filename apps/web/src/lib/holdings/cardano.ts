import { useEffect, useMemo, useState } from "react";
import { cacheGet, cacheHash, cacheKey, POLICIES } from "../defi/cache.ts";
import { cardanoSession, cipEpochNow, readCardanoValue, stakeFromPayment, subscribeCip, type CardanoSession } from "../cardanoCip30.ts";
import { koiosPost } from "../koios.ts";
import { cardanoByUnit, tokensFor, type TokenRecord } from "../tokenRegistry.ts";
import { outboundFetch } from "../outbound.ts";
import { syncLiveFlag, useLiveStatus } from "../liveStatus.ts";
import { addrList, fmt, hexAscii, row, sortHoldings, type HoldingRow } from "./shared.ts";

type CardanoAsset = {
  policy_id?: string;
  asset_policy?: string;
  asset_name?: string;
  quantity?: string;
  decimals?: number;
  asset_list?: CardanoAsset[];
};

function flattenCardanoAssets(raw: unknown): CardanoAsset[] {
  if (!Array.isArray(raw)) return [];
  const out: CardanoAsset[] = [];
  for (const item of raw as CardanoAsset[]) {
    if (Array.isArray(item.asset_list)) out.push(...item.asset_list);
    else out.push(item);
  }
  return out;
}

function cardanoUnit(a: CardanoAsset) {
  return `${a.policy_id ?? a.asset_policy ?? ""}${a.asset_name ?? ""}`.toLowerCase();
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function asKoiosRows<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as T[];
    if (Array.isArray(o.result)) return o.result as T[];
  }
  return [];
}

function stakeOf(addr: string) {
  const s = addr.trim();
  if (s.startsWith("stake") || s.startsWith("stake_test")) return s;
  return stakeFromPayment(s);
}

function cipOwns(session: CardanoSession | null, addr: string) {
  if (!session) return false;
  const st = stakeOf(addr);
  if (session.stake && st && session.stake === st) return true;
  if (session.address === addr) return true;
  return (session.addresses ?? []).includes(addr);
}

function extrasOwns(addr: string, extras?: { addresses?: string[]; stake?: string }) {
  if (!extras) return false;
  if (extras.addresses?.includes(addr)) return true;
  const st = extras.stake || "";
  if (st && (addr === st || stakeOf(addr) === st)) return true;
  return false;
}

function takeMaxQty(qty: Map<string, { raw: bigint; decimals: number }>, part: Map<string, { raw: bigint; decimals: number }>) {
  for (const [unit, bal] of part) {
    const prev = qty.get(unit);
    qty.set(unit, {
      raw: (prev?.raw ?? 0n) > bal.raw ? (prev?.raw ?? 0n) : bal.raw,
      decimals: bal.decimals || prev?.decimals || 0,
    });
  }
}

function rowsFromCardano(
  catalog: TokenRecord[],
  ada: bigint,
  qty: Map<string, { raw: bigint; decimals: number }>,
): HoldingRow[] {
  const next: HoldingRow[] = [];
  const adaMeta = catalog.find((t) => t.native);
  if (adaMeta) next.push(row(adaMeta, ada, true));
  const seen = new Set<string>();
  for (const [unit, bal] of qty) {
    seen.add(unit);
    const known = cardanoByUnit(unit);
    if (known) {
      next.push(row(known, bal.raw, true));
    } else {
      const ticker = hexAscii(unit.slice(56)) || unit.slice(0, 8).toUpperCase();
      next.push({
        id: `ada-${unit}`,
        symbol: ticker,
        name: ticker,
        icon: "/tokens/ada.png",
        amount: fmt(bal.raw, bal.decimals),
        raw: bal.raw,
        contract: unit,
        chainTag: "ADA",
        chainId: 1815,
        decimals: bal.decimals,
      });
    }
  }
  for (const t of catalog) {
    if (t.native || (t.address && seen.has(t.address.toLowerCase()))) continue;
    next.push(row(t, 0n, true));
  }
  return sortHoldings(next, true);
}

function koiosPayList(json: unknown) {
  const out: string[] = [];
  for (const r of asKoiosRows<Record<string, unknown>>(json)) {
    if (typeof r.address === "string" && r.address.startsWith("addr")) out.push(r.address);
    if (Array.isArray(r.addresses)) {
      for (const a of r.addresses) if (typeof a === "string" && a.startsWith("addr")) out.push(a);
    }
  }
  return out;
}

function asQty() {
  return new Map<string, { raw: bigint; decimals: number }>();
}

function addAsset(qty: Map<string, { raw: bigint; decimals: number }>, unit: string, raw: bigint, decimals: number) {
  if (!unit) return;
  const prev = qty.get(unit);
  qty.set(unit, { raw: (prev?.raw ?? 0n) + raw, decimals: decimals || prev?.decimals || 0 });
}

type YoroiUtxo = {
  amount?: string;
  assets?: Array<{ policyId?: string; name?: string; amount?: string }>;
};

async function fetchYoroiUtxos(addresses: string[]) {
  const pays = [...new Set(addresses.filter((a) => a.startsWith("addr")))];
  const qty = asQty();
  let ada = 0n;
  if (!pays.length) return { ada, qty };
  for (const group of chunk(pays, 50)) {
    try {
      const json = await cacheGet(
        {
          key: cacheKey("http.yoroi", 1815, "utxo", cacheHash(group)),
          policy: POLICIES.account,
        },
        async () => {
          const res = await outboundFetch("https://iohk-mainnet.yoroiwallet.com/api/txs/utxoForAddresses", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ addresses: group }),
          });
          if (!res.ok) throw new Error(`yoroi ${res.status}`);
          return res.json();
        },
      );
      const rows = Array.isArray(json) ? (json as YoroiUtxo[]) : [];
      for (const u of rows) {
        try {
          ada += BigInt(u.amount || "0");
        } catch {
          /* skip */
        }
        for (const a of u.assets ?? []) {
          const unit = `${a.policyId ?? ""}${a.name ?? ""}`.toLowerCase();
          try {
            addAsset(qty, unit, BigInt(a.amount || "0"), cardanoByUnit(unit)?.decimals ?? 0);
          } catch {
            /* skip */
          }
        }
      }
    } catch {
      /* yoroi optional */
    }
  }
  return { ada, qty };
}

type KoiosUtxo = {
  address?: string;
  value?: string;
  asset_list?: CardanoAsset[];
};

async function fetchCardanoChain(address: string, extras?: { addresses?: string[]; stake?: string }) {
  const stake = extras?.stake || stakeOf(address);
  let pays = [...new Set([address, ...(extras?.addresses ?? [])].filter((a) => a.startsWith("addr")))];
  const qty = asQty();
  let ada = 0n;

  if (stake.startsWith("stake")) {
    const [utxoJson, infoJson, assetJson, addrJson] = await Promise.all([
      koiosPost("account_utxos", { _stake_addresses: [stake], _extended: true }).catch(() => []),
      koiosPost("account_info", { _stake_addresses: [stake] }).catch(() => []),
      koiosPost("account_assets", { _stake_addresses: [stake] }).catch(() => []),
      koiosPost("account_addresses", { _stake_addresses: [stake] }).catch(() => []),
    ]);
    const utxos = asKoiosRows<KoiosUtxo>(utxoJson);
    for (const u of utxos) {
      if (u.address?.startsWith("addr")) pays.push(u.address);
      try {
        ada += BigInt(u.value || "0");
      } catch {
        /* skip */
      }
      for (const a of u.asset_list ?? []) {
        try {
          addAsset(qty, cardanoUnit(a), BigInt(a.quantity ?? "0"), cardanoByUnit(cardanoUnit(a))?.decimals ?? a.decimals ?? 0);
        } catch {
          /* skip */
        }
      }
    }
    const info = asKoiosRows<{ utxo?: string; total_balance?: string }>(infoJson)[0];
    try {
      const listed = BigInt(info?.utxo || "0");
      if (listed > ada) ada = listed;
    } catch {
      /* skip */
    }
    if (!utxos.length) {
      if (ada === 0n) {
        try {
          ada = BigInt(info?.utxo || info?.total_balance || "0");
        } catch {
          ada = 0n;
        }
      }
      for (const a of flattenCardanoAssets(assetJson)) {
        try {
          addAsset(qty, cardanoUnit(a), BigInt(a.quantity ?? "0"), cardanoByUnit(cardanoUnit(a))?.decimals ?? a.decimals ?? 0);
        } catch {
          /* skip */
        }
      }
    }
    pays.push(...koiosPayList(addrJson));
  }

  pays = [...new Set(pays.filter((a) => a.startsWith("addr")))];
  if (ada === 0n && pays.length) {
    for (const group of chunk(pays, 50)) {
      const info = asKoiosRows<{ balance?: string }>(
        await koiosPost("address_info", { _addresses: group }).catch(() => []),
      );
      for (const rowInfo of info) {
        try {
          ada += BigInt(rowInfo.balance ?? "0");
        } catch {
          /* skip */
        }
      }
      for (const a of flattenCardanoAssets(await koiosPost("address_assets", { _addresses: group }).catch(() => []))) {
        try {
          addAsset(qty, cardanoUnit(a), BigInt(a.quantity ?? "0"), cardanoByUnit(cardanoUnit(a))?.decimals ?? a.decimals ?? 0);
        } catch {
          /* skip */
        }
      }
    }
  }

  const yoroi = await fetchYoroiUtxos(pays);
  if (yoroi.ada > ada) ada = yoroi.ada;
  takeMaxQty(qty, yoroi.qty);
  return { ada, qty };
}

export function useCardanoHoldings(
  address: string | string[],
  extras?: { addresses?: string[]; stake?: string; sync?: number },
) {
  const catalog = useMemo(() => tokensFor("cardano", 1815), []);
  const [rows, setRows] = useState<HoldingRow[]>(() => catalog.map((t) => row(t, null, false)));
  const [loading, setLoading] = useState(false);
  const [cipTick, setCipTick] = useState(0);
  const listKey = Array.isArray(address) ? address.join("|") : address;
  const list = useMemo(() => addrList(address), [listKey]);
  const primary = list[0] ?? "";
  const stake = extras?.stake || (primary ? stakeFromPayment(primary) : "");
  const payKey = (extras?.addresses ?? []).filter(Boolean).join("|");
  const addrKey = [list.join("|"), stake, extras?.sync ?? 0, payKey].join("|");
  const connected = list.length > 0;

  useEffect(() => subscribeCip(() => setCipTick(cipEpochNow())), []);

  useEffect(() => {
    if (!list.length) {
      setRows(catalog.map((t) => row(t, null, false)));
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        let ada = 0n;
        const qty = new Map<string, { raw: bigint; decimals: number }>();
        const session = cardanoSession();
        const cipHit = list.some((a) => cipOwns(session, a));
        if (cipHit) {
          const cip = await readCardanoValue();
          if (cip && (cip.ada > 0n || cip.assets.size > 0)) {
            ada = cip.ada;
            for (const [unit, raw] of cip.assets) {
              qty.set(unit, { raw, decimals: cardanoByUnit(unit)?.decimals ?? 0 });
            }
          }
        }

        const seenStake = new Set<string>();
        for (const addr of list) {
          const extra = extrasOwns(addr, extras) ? extras : undefined;
          const st = extra?.stake || stakeOf(addr);
          if (st.startsWith("stake")) {
            if (seenStake.has(st)) continue;
            seenStake.add(st);
          }
          try {
            const part = await fetchCardanoChain(addr, extra);
            if (part.ada > ada) ada = part.ada;
            takeMaxQty(qty, part.qty);
          } catch {
            /* one address */
          }
        }
        if (!cancelled) setRows(rowsFromCardano(catalog, ada, qty));
      } catch {
        if (!cancelled) {
          setRows((prev) => (prev.some((r) => r.raw > 0n) ? prev : catalog.map((t) => row(t, null, true))));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addrKey, catalog, cipTick, list, stake]);

  const funded = rows.filter((r) => r.raw > 0n).length;
  useEffect(() => {
    syncLiveFlag("holdings:1815", 1815, "holdings", connected && loading);
    return () => useLiveStatus.getState().finish("holdings:1815", true);
  }, [connected, loading]);
  return { rows, funded, loading, catalogSize: catalog.length };
}
