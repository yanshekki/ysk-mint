import { useMemo } from "react";
import { tokensFor } from "../tokenRegistry.ts";
import { endpointByUrl, rpcEndpoints } from "../rpcCatalog.ts";
import { markRpcLive, rpcJsonRpc, rpcOutboundFetch, rpcTry } from "../rpcPool.ts";
import { addrList, mergeBals, useJsonHoldings, type BalHit } from "./shared.ts";

async function fetchHyperCore(user: string) {
  const out = new Map<string, BalHit>();
  const [state, meta] = await Promise.all([
    rpcTry(998, async (url, signal) => {
      const r = await rpcOutboundFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "spotClearinghouseState", user }),
        signal,
      });
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<{ balances?: Array<{ coin: string; total: string; token?: number }> }>;
    }),
    rpcTry(998, async (url, signal) => {
      const r = await rpcOutboundFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "spotMeta" }),
        signal,
      });
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<{ tokens?: Array<{ name: string; weiDecimals: number; szDecimals: number; tokenId?: string }> }>;
    }),
  ]);
  const dec = new Map((meta.tokens ?? []).map((t) => [t.name, t.weiDecimals ?? t.szDecimals ?? 8]));
  for (const b of state.balances ?? []) {
    const decimals = dec.get(b.coin) ?? 8;
    const n = Number(b.total);
    if (!Number.isFinite(n) || n <= 0) continue;
    const raw = BigInt(Math.round(n * 10 ** Math.min(decimals, 8)));
    const rec = { raw, decimals: Math.min(decimals, 8), symbol: b.coin, name: b.coin, icon: "/tokens/hype.png", contract: b.coin };
    if (b.coin === "HYPE" || b.coin === "UBTC") out.set(b.coin === "HYPE" ? "native" : b.coin, rec);
    else out.set(b.coin, rec);
  }
  return out;
}

export function useHyperCoreHoldings(address: string | string[] | undefined) {
  const catalog = useMemo(() => tokensFor("hypercore", 998), []);
  const accKey = Array.isArray(address) ? address.join("|") : (address ?? "");
  const addrs = useMemo(() => addrList(address), [accKey]);
  const load = useMemo(
    () => async () => mergeBals(await Promise.all(addrs.map(fetchHyperCore))),
    [accKey, addrs],
  );
  return useJsonHoldings(998, catalog, addrs.length > 0, load);
}

async function fetchTron(addr: string) {
  const out = new Map<string, BalHit>();
  const json = await rpcTry(728126428, async (base, signal) => {
    const r = await rpcOutboundFetch(`${base.replace(/\/+$/, "")}/v1/accounts/${addr}`, { signal });
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<{ data?: Array<{ balance?: number; trc20?: Array<Record<string, string>> }> }>;
  });
  const acc = json.data?.[0];
  out.set("native", { raw: BigInt(acc?.balance ?? 0), decimals: 6, symbol: "TRX" });
  for (const item of acc?.trc20 ?? []) {
    for (const [contract, amount] of Object.entries(item)) {
      out.set(contract, { raw: BigInt(amount || "0"), decimals: 6, symbol: contract.slice(0, 4), contract });
    }
  }
  return out;
}

export function useTronHoldings(address: string | string[]) {
  const catalog = useMemo(() => tokensFor("tron", 728126428), []);
  const accKey = Array.isArray(address) ? address.join("|") : address;
  const addrs = useMemo(() => addrList(address), [accKey]);
  const load = useMemo(
    () => async () => mergeBals(await Promise.all(addrs.map(fetchTron))),
    [accKey, addrs],
  );
  return useJsonHoldings(728126428, catalog, addrs.length > 0, load);
}

async function fetchSui(addr: string) {
  const out = new Map<string, BalHit>();
  const coins = await rpcJsonRpc<Array<{ coinType: string; totalBalance: string }>>(784, "suix_getAllBalances", [addr]).catch(() => [] as Array<{ coinType: string; totalBalance: string }>);
  for (const b of coins ?? []) {
    const rec = { raw: BigInt(b.totalBalance || "0"), decimals: 9, symbol: b.coinType.split("::").pop(), contract: b.coinType };
    if (b.coinType.endsWith("::sui::SUI")) out.set("native", rec);
    else out.set(b.coinType, rec);
  }
  return out;
}

export function useSuiHoldings(address: string | string[]) {
  const catalog = useMemo(() => tokensFor("sui", 784), []);
  const accKey = Array.isArray(address) ? address.join("|") : address;
  const addrs = useMemo(() => addrList(address), [accKey]);
  const load = useMemo(
    () => async () => mergeBals(await Promise.all(addrs.map(fetchSui))),
    [accKey, addrs],
  );
  return useJsonHoldings(784, catalog, addrs.length > 0, load);
}

type TonJet = { jetton?: { address?: string; symbol?: string; decimals?: number }; balance?: string };

function applyTonJettons(out: Map<string, BalHit>, jets: { balances?: TonJet[] }) {
  for (const j of jets.balances ?? []) {
    const contract = j.jetton?.address ?? "";
    if (!contract) continue;
    out.set(contract, {
      raw: BigInt(j.balance ?? "0"),
      decimals: j.jetton?.decimals ?? 9,
      symbol: j.jetton?.symbol,
      contract,
    });
  }
}

async function fetchTon(addr: string) {
  const out = await rpcTry(607, async (url, signal) => {
    const map = new Map<string, BalHit>();
    if (endpointByUrl(607, url)?.id === "tonapi") {
      const acc = await rpcOutboundFetch(`${url.replace(/\/+$/, "")}/v2/accounts/${addr}`, { signal });
      if (!acc.ok) throw new Error(String(acc.status));
      const json = (await acc.json()) as { balance?: number | string };
      map.set("native", { raw: BigInt(String(json.balance ?? 0)), decimals: 9, symbol: "TON" });
      try {
        const jetsRes = await rpcOutboundFetch(`${url.replace(/\/+$/, "")}/v2/accounts/${addr}/jettons`, { signal });
        if (jetsRes.ok) applyTonJettons(map, (await jetsRes.json()) as { balances?: TonJet[] });
      } catch {
        /* jettons optional */
      }
      return map;
    }
    const base = url.replace(/\/jsonRPC$/i, "").replace(/\/+$/, "");
    const acc = await rpcOutboundFetch(`${base}/getAddressBalance?address=${encodeURIComponent(addr)}`, { signal });
    if (!acc.ok) throw new Error(String(acc.status));
    const json = (await acc.json()) as { result?: string };
    map.set("native", { raw: BigInt(json.result ?? "0"), decimals: 9, symbol: "TON" });
    return map;
  });
  if ([...out.keys()].some((k) => k !== "native")) return out;
  const tonapi = rpcEndpoints(607).find((e) => e.id === "tonapi");
  if (!tonapi) return out;
  try {
    const jetsRes = await rpcOutboundFetch(`${tonapi.url.replace(/\/+$/, "")}/v2/accounts/${addr}/jettons`);
    if (jetsRes.ok) applyTonJettons(out, (await jetsRes.json()) as { balances?: TonJet[] });
  } catch {
    /* native only */
  }
  return out;
}

export function useTonHoldings(address: string | string[]) {
  const catalog = useMemo(() => tokensFor("ton", 607), []);
  const accKey = Array.isArray(address) ? address.join("|") : address;
  const addrs = useMemo(() => addrList(address), [accKey]);
  const load = useMemo(
    () => async () => mergeBals(await Promise.all(addrs.map(fetchTon))),
    [accKey, addrs],
  );
  return useJsonHoldings(607, catalog, addrs.length > 0, load);
}

async function fetchAptos(addr: string) {
  const out = new Map<string, BalHit>();
  const apt = await rpcTry(637, async (base, signal) => {
    const r = await rpcOutboundFetch(
      `${base.replace(/\/+$/, "")}/accounts/${addr}/resource/0x1::coin::CoinStore%3C0x1::aptos_coin::AptosCoin%3E`,
      { signal },
    );
    if (r.status === 404) throw markRpcLive(new Error("404"));
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<{ data?: { coin?: { value?: string } } }>;
  }).catch((err) => {
    if (err instanceof Error && err.message === "404") return { data: { coin: { value: "0" } } };
    throw err;
  });
  out.set("native", { raw: BigInt(apt.data?.coin?.value ?? "0"), decimals: 8, symbol: "APT" });
  try {
    const coins = await rpcTry(637, async (base, signal) => {
      const r = await rpcOutboundFetch(`${base.replace(/\/+$/, "")}/accounts/${addr}/fungible_asset_balances`, { signal });
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<Array<{ asset_type?: string; amount?: string; metadata?: { symbol?: string; decimals?: number } }>>;
    }).catch(() => [] as Array<{ asset_type?: string; amount?: string; metadata?: { symbol?: string; decimals?: number } }>);
    for (const c of coins) {
      if (!c.asset_type) continue;
      const rec = { raw: BigInt(c.amount ?? "0"), decimals: c.metadata?.decimals ?? 8, symbol: c.metadata?.symbol, contract: c.asset_type };
      if (c.asset_type.includes("aptos_coin")) out.set("native", rec);
      else out.set(c.asset_type, rec);
    }
  } catch {
    /* fa optional */
  }
  return out;
}

export function useAptosHoldings(address: string | string[]) {
  const catalog = useMemo(() => tokensFor("aptos", 637), []);
  const accKey = Array.isArray(address) ? address.join("|") : address;
  const addrs = useMemo(() => addrList(address), [accKey]);
  const load = useMemo(
    () => async () => mergeBals(await Promise.all(addrs.map(fetchAptos))),
    [accKey, addrs],
  );
  return useJsonHoldings(637, catalog, addrs.length > 0, load);
}

async function fetchBitcoin(addr: string) {
  const out = new Map<string, BalHit>();
  const json = await rpcTry(833, async (base, signal) => {
    const r = await rpcOutboundFetch(`${base.replace(/\/+$/, "")}/address/${addr}`, { signal });
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<{ chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number } }>;
  });
  const s = json.chain_stats;
  out.set("native", { raw: BigInt((s?.funded_txo_sum ?? 0) - (s?.spent_txo_sum ?? 0)), decimals: 8, symbol: "BTC" });
  return out;
}

export function useBitcoinHoldings(address: string | string[]) {
  const catalog = useMemo(() => tokensFor("bitcoin", 833), []);
  const accKey = Array.isArray(address) ? address.join("|") : address;
  const addrs = useMemo(() => addrList(address), [accKey]);
  const load = useMemo(
    () => async () => mergeBals(await Promise.all(addrs.map(fetchBitcoin))),
    [accKey, addrs],
  );
  return useJsonHoldings(833, catalog, addrs.length > 0, load);
}

async function fetchXrpl(addr: string) {
  const out = new Map<string, BalHit>();
  const info = await rpcTry(144, async (url, signal) => {
    const r = await rpcOutboundFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "account_info", params: [{ account: addr, ledger_index: "validated" }] }),
      signal,
    });
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<{ result?: { account_data?: { Balance?: string } } }>;
  });
  out.set("native", { raw: BigInt(info.result?.account_data?.Balance ?? "0"), decimals: 6, symbol: "XRP" });
  try {
    const lines = await rpcTry(144, async (url, signal) => {
      const r = await rpcOutboundFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "account_lines", params: [{ account: addr, ledger_index: "validated" }] }),
        signal,
      });
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<{ result?: { lines?: Array<{ currency?: string; balance?: string; account?: string }> } }>;
    });
    for (const l of lines.result?.lines ?? []) {
      const n = Number(l.balance);
      if (!Number.isFinite(n) || n === 0) continue;
      const raw = BigInt(Math.round(Math.abs(n) * 1e6));
      const code = l.currency && l.currency.length <= 3 ? l.currency : (l.currency ?? "IOU").slice(0, 4);
      out.set(`${l.account}:${l.currency}`, { raw, decimals: 6, symbol: code, contract: l.account });
    }
  } catch {
    /* lines optional */
  }
  return out;
}

export function useXrplHoldings(address: string | string[]) {
  const catalog = useMemo(() => tokensFor("xrpl", 144), []);
  const accKey = Array.isArray(address) ? address.join("|") : address;
  const addrs = useMemo(() => addrList(address), [accKey]);
  const load = useMemo(
    () => async () => mergeBals(await Promise.all(addrs.map(fetchXrpl))),
    [accKey, addrs],
  );
  return useJsonHoldings(144, catalog, addrs.length > 0, load);
}

async function fetchStellar(addr: string) {
  const out = new Map<string, BalHit>();
  const json = await rpcTry(148, async (base, signal) => {
    const r = await rpcOutboundFetch(`${base.replace(/\/+$/, "")}/accounts/${addr}`, { signal });
    if (r.status === 404) throw markRpcLive(new Error("404"));
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<{ balances?: Array<{ asset_type?: string; asset_code?: string; asset_issuer?: string; balance?: string }> }>;
  }).catch((err) => {
    if (err instanceof Error && err.message === "404") return { balances: [] as Array<{ asset_type?: string; asset_code?: string; asset_issuer?: string; balance?: string }> };
    throw err;
  });
  if (!json.balances?.length) {
    out.set("native", { raw: 0n, decimals: 7, symbol: "XLM" });
    return out;
  }
  for (const b of json.balances ?? []) {
    const n = Number(b.balance);
    if (!Number.isFinite(n)) continue;
    if (b.asset_type === "native") {
      out.set("native", { raw: BigInt(Math.round(n * 1e7)), decimals: 7, symbol: "XLM" });
    } else if (n > 0) {
      const code = b.asset_code ?? "TOKEN";
      out.set(`${code}:${b.asset_issuer}`, { raw: BigInt(Math.round(n * 1e7)), decimals: 7, symbol: code, contract: b.asset_issuer });
    }
  }
  return out;
}

export function useStellarHoldings(address: string | string[]) {
  const catalog = useMemo(() => tokensFor("stellar", 148), []);
  const accKey = Array.isArray(address) ? address.join("|") : address;
  const addrs = useMemo(() => addrList(address), [accKey]);
  const load = useMemo(
    () => async () => mergeBals(await Promise.all(addrs.map(fetchStellar))),
    [accKey, addrs],
  );
  return useJsonHoldings(148, catalog, addrs.length > 0, load);
}

function useCosmosLcd(chainId: number, denom: string, symbol: string, address: string | string[]) {
  const catalog = useMemo(() => tokensFor("cosmos", chainId), [chainId]);
  const accKey = Array.isArray(address) ? address.join("|") : address;
  const addrs = useMemo(() => addrList(address), [accKey]);
  const load = useMemo(
    () => async () => {
      const maps = await Promise.all(
        addrs.map(async (addr) => {
          const out = new Map<string, BalHit>();
          const json = await rpcTry(chainId, async (lcd, signal) => {
            const r = await rpcOutboundFetch(`${lcd.replace(/\/+$/, "")}/cosmos/bank/v1beta1/balances/${addr}`, { signal });
            if (!r.ok) throw new Error(String(r.status));
            return r.json() as Promise<{ balances?: Array<{ denom?: string; amount?: string }> }>;
          });
          for (const b of json.balances ?? []) {
            const raw = BigInt(b.amount ?? "0");
            if (b.denom === denom) out.set("native", { raw, decimals: 6, symbol });
            else if (raw > 0n)
              out.set(b.denom ?? "coin", { raw, decimals: 6, symbol: (b.denom ?? "COIN").replace("u", "").toUpperCase().slice(0, 6), contract: b.denom });
          }
          return out;
        }),
      );
      return mergeBals(maps);
    },
    [accKey, addrs, chainId, denom, symbol],
  );
  return useJsonHoldings(chainId, catalog, addrs.length > 0, load);
}

export function useCosmosHoldings(address: string | string[]) {
  return useCosmosLcd(118, "uatom", "ATOM", address);
}

export function useOsmosisHoldings(address: string | string[]) {
  return useCosmosLcd(100001, "uosmo", "OSMO", address);
}

export function useCelestiaHoldings(address: string | string[]) {
  return useCosmosLcd(100002, "utia", "TIA", address);
}

const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const STRK_ETH = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
const BALANCE_OF = "0x2e4263afad30923c891518314bc6c76fb0d7785f8041c2b491b3c0c5afb690";

async function starknetBalance(contract: string, owner: string) {
  const felt = owner.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const result = await rpcJsonRpc<string[]>(100003, "starknet_call", [
    { contract_address: contract, entry_point_selector: BALANCE_OF, calldata: [`0x${felt}`] },
    "latest",
  ]);
  const low = BigInt(result?.[0] ?? "0");
  const high = BigInt(result?.[1] ?? "0");
  return low + (high << 128n);
}

export function useStarknetHoldings(address: string | string[]) {
  const catalog = useMemo(() => tokensFor("starknet", 100003), []);
  const accKey = Array.isArray(address) ? address.join("|") : address;
  const addrs = useMemo(() => addrList(address), [accKey]);
  const load = useMemo(
    () => async () => {
      const maps = await Promise.all(
        addrs.map(async (addr) => {
          const out = new Map<string, BalHit>();
          const [strk, eth] = await Promise.all([starknetBalance(STRK, addr).catch(() => 0n), starknetBalance(STRK_ETH, addr).catch(() => 0n)]);
          out.set("native", { raw: strk, decimals: 18, symbol: "STRK" });
          if (eth > 0n) out.set(STRK_ETH, { raw: eth, decimals: 18, symbol: "ETH", contract: STRK_ETH, icon: "/tokens/eth.png" });
          return out;
        }),
      );
      return mergeBals(maps);
    },
    [accKey, addrs],
  );
  return useJsonHoldings(100003, catalog, addrs.length > 0, load);
}
