import { endpointByUrl, normUrl, parseRpc, providerIdFromUrl, RPC_PROVIDER_LABEL, rpcEndpoints, type RpcEndpoint } from "./rpcCatalog.ts";
import { hostIsCooling, outboundFetch, type OutboundInit } from "./outbound.ts";
import { onUserSettingsReset, useUserSettings } from "./userSettings.ts";

export const RPC_TIMEOUT_MS = 30_000;

const lastGood = new Map<number, string>();
const shuffleCache = new Map<number, string[]>();
const sessionListeners = new Set<() => void>();

export function rpcResetSession() {
  lastGood.clear();
  shuffleCache.clear();
  notifySession();
}

export function rpcLastGood(chainId: number) {
  return lastGood.get(chainId);
}

export function subscribeRpcSession(fn: () => void) {
  sessionListeners.add(fn);
  return () => {
    sessionListeners.delete(fn);
  };
}

function notifySession() {
  for (const fn of sessionListeners) fn();
}

function rememberGood(chainId: number, url: string) {
  if (lastGood.get(chainId) === url) return;
  lastGood.set(chainId, url);
  notifySession();
}

function forgetGood(chainId: number, url: string) {
  if (lastGood.get(chainId) !== url) return;
  lastGood.delete(chainId);
  notifySession();
}

function sameUrl(a: string, b: string) {
  return normUrl(a) === normUrl(b);
}

function shuffleUrls(urls: string[]): string[] {
  const out = [...urls];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

function customEndpoint(chainId: number): RpcEndpoint | undefined {
  const raw = useUserSettings.getState().rpcByChain?.[String(chainId)]?.trim();
  if (!raw) return undefined;
  const url = parseRpc(raw);
  if (!url) return undefined;
  return { id: "custom", name: "Custom", url };
}

export function rpcOrderedEndpoints(chainId: number): RpcEndpoint[] {
  const s = useUserSettings.getState();
  const catalog = rpcEndpoints(chainId);
  const custom = customEndpoint(chainId);
  const pick = s.rpcPickByChain?.[String(chainId)];
  const seen = new Set<string>();
  const out: RpcEndpoint[] = [];
  const push = (row: RpcEndpoint | undefined) => {
    if (!row?.url) return;
    const key = normUrl(row.url);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(row);
  };

  push(custom);

  const rest = catalog.filter((row) => !seen.has(normUrl(row.url)));

  if (pick && pick !== "inherit" && pick !== "custom") {
    for (const row of rest.filter((e) => e.id === pick)) push(row);
    for (const row of rest.filter((e) => e.id !== pick)) push(row);
  } else if (s.rpcStrategy === "random") {
    const catalogUrls = rest.map((e) => e.url);
    let urls = shuffleCache.get(chainId);
    if (!urls || urls.length !== catalogUrls.length || urls.some((u) => !catalogUrls.includes(u))) {
      urls = shuffleUrls(catalogUrls);
      shuffleCache.set(chainId, urls);
    }
    const byUrl = new Map(rest.map((e) => [e.url, e]));
    for (const url of urls) push(byUrl.get(url));
    for (const row of rest) push(row);
  } else {
    const want = s.rpcProvider;
    const pref = rest.filter((e) => e.id === want || (want !== "official" && providerIdFromUrl(e.url) === want));
    const official = rest.filter((e) => e.id === "official" && !pref.includes(e));
    const other = rest.filter((e) => !pref.includes(e) && !official.includes(e));
    for (const row of [...pref, ...official, ...other]) push(row);
  }

  const good = lastGood.get(chainId);
  if (good && (!custom || !sameUrl(good, custom.url))) {
    const idx = out.findIndex((e) => e.id !== "custom" && sameUrl(e.url, good));
    if (idx >= 0) {
      const hit = out[idx]!;
      const without = out.filter((_, i) => i !== idx);
      if (without[0]?.id === "custom") return [without[0], hit, ...without.slice(1)];
      return [hit, ...without];
    }
  }
  return out;
}

export function rpcOrder(chainId: number): string[] {
  return rpcOrderedEndpoints(chainId).map((e) => e.url);
}

function nameOf(row: RpcEndpoint | undefined, url?: string) {
  if (row) return row.name;
  if (!url) return "Official";
  const brand = providerIdFromUrl(url);
  return brand === "official" ? "Official" : (RPC_PROVIDER_LABEL[brand] ?? brand);
}

export function rpcActiveLabel(chainId: number): string {
  const custom = customEndpoint(chainId);
  const good = lastGood.get(chainId);
  if (good) {
    const hit =
      rpcOrderedEndpoints(chainId).find((e) => sameUrl(e.url, good)) ??
      endpointByUrl(chainId, good) ??
      (custom && sameUrl(custom.url, good) ? custom : undefined);
    return nameOf(hit, good);
  }
  if (custom) return custom.name;
  const first = rpcOrderedEndpoints(chainId)[0];
  if (first) return first.name;
  return rpcEndpoints(chainId).find((e) => e.id === "official")?.name ?? rpcEndpoints(chainId)[0]?.name ?? "Official";
}

function isLiveErr(err: unknown) {
  return Boolean(err && typeof err === "object" && (err as { rpcLive?: boolean }).rpcLive);
}

export function markRpcLive<T extends Error>(err: T): T {
  Object.assign(err, { rpcLive: true });
  return err;
}

export function rpcOutboundFetch(input: RequestInfo | URL, init?: RequestInit) {
  const next: OutboundInit = { ...init, failoverOn429: true };
  return outboundFetch(input, next);
}

export async function rpcTry<T>(chainId: number, fn: (url: string, signal: AbortSignal) => Promise<T>): Promise<T> {
  const rows = rpcOrderedEndpoints(chainId);
  const ready = rows.filter((row) => !hostIsCooling(row.url));
  const queue = ready.length ? ready : rows;
  let last: unknown = new Error("no rpc");
  for (const row of queue) {
    if (ready.length && hostIsCooling(row.url)) continue;
    const ctrl = new AbortController();
    const timer = globalThis.setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
    try {
      const out = await fn(row.url, ctrl.signal);
      rememberGood(chainId, row.url);
      return out;
    } catch (err) {
      if (isLiveErr(err)) {
        rememberGood(chainId, row.url);
        throw err;
      }
      forgetGood(chainId, row.url);
      last = err;
    } finally {
      globalThis.clearTimeout(timer);
    }
  }
  throw last instanceof Error ? last : new Error("rpc");
}

export async function rpcFetch(chainId: number, init?: RequestInit): Promise<Response> {
  return rpcTry(chainId, async (url, signal) => {
    const res = await rpcOutboundFetch(url, { ...init, signal });
    if (!res.ok) throw new Error(`rpc ${res.status}`);
    return res;
  });
}

export async function rpcJsonRpc<T>(chainId: number, method: string, params: unknown): Promise<T> {
  return rpcTry(chainId, async (url, signal) => {
    const res = await rpcOutboundFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal,
    });
    if (!res.ok) throw new Error(`rpc ${res.status}`);
    const text = await res.text();
    if (!text.trim()) throw new Error("rpc empty");
    let json: { result?: T; error?: { message?: string; code?: number; data?: unknown } };
    try {
      json = JSON.parse(text) as { result?: T; error?: { message?: string; code?: number; data?: unknown } };
    } catch {
      throw new Error("rpc json");
    }
    if (json.error) {
      const err = markRpcLive(new Error(json.error.message || "rpc"));
      Object.assign(err, { code: json.error.code, data: json.error.data });
      throw err;
    }
    return json.result as T;
  });
}

if (typeof window !== "undefined") {
  onUserSettingsReset(rpcResetSession);
  useUserSettings.subscribe((s, prev) => {
    if (
      s.rpcStrategy !== prev.rpcStrategy ||
      s.rpcProvider !== prev.rpcProvider ||
      s.rpcPickByChain !== prev.rpcPickByChain ||
      s.rpcByChain !== prev.rpcByChain
    ) {
      rpcResetSession();
    }
  });
}
