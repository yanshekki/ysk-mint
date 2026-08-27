export type CacheKind = "ok" | "empty" | "error";
export type CacheScope = "global" | "account";

export type CachePolicy<T> = {
  class: string;
  ttlMs: number;
  staleMs: number;
  persist: boolean;
  keep?: (value: T) => boolean;
  scope: CacheScope;
  account?: string;
  negTtlMs?: number;
  emptyTtlMs?: number;
};

export type CacheRecord<T> = {
  key: string;
  at: number;
  freshUntil: number;
  staleUntil: number;
  value: T;
  cursor?: string;
  scope: CacheScope;
  account?: string;
  class: string;
};

type Good = {
  key: string;
  at: number;
  freshUntil: number;
  staleUntil: number;
  value: unknown;
  cursor?: string;
  scope: CacheScope;
  account?: string;
  class: string;
  persist: boolean;
};

type Neg = { at: number; kind: "empty" | "error"; err?: string; value?: unknown };

const SCHEMA = 1;
const DB_NAME = "ysk-web3";
const STORE = "kv";
const BUDGET = 8 * 1024 * 1024;
const KEEP_CLASS = new Set(["meta", "ens"]);

const good = new Map<string, Good>();
const neg = new Map<string, Neg>();
const inflight = new Map<string, Promise<unknown>>();

const NEG_TTL = 5_000;
const EMPTY_TTL = 15_000;

function dbg(...args: unknown[]) {
  try {
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem("ysk-cache-debug") !== "1") return;
    console.debug("[ysk-cache]", ...args);
  } catch {
    /* private mode */
  }
}

export function cacheKey(cls: string, chainId: number | string, ...parts: Array<string | number>): string {
  return ["v1", cls, String(chainId), ...parts.map((p) => String(p).toLowerCase())].join(":");
}

export function cacheHash(value: unknown) {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}

export function accountCache<T>(cls: string, chainId: number | string, account: string, extra: string, fn: () => Promise<T>): Promise<T> {
  const a = account.toLowerCase();
  return cacheGet(
    {
      key: cacheKey(cls, chainId, a, extra),
      policy: { ...POLICIES.account, account: a },
    },
    fn,
  );
}

function jitter(ttlMs: number) {
  return Math.floor(ttlMs * (0.9 + Math.random() * 0.2));
}

function now() {
  return Date.now();
}

function isKeep<T>(policy: CachePolicy<T>, value: T) {
  return !policy.keep || policy.keep(value);
}

function persistable(policy: CachePolicy<unknown>) {
  return policy.persist && policy.scope !== "account";
}

function reviveBn(value: unknown): unknown {
  if (value && typeof value === "object") {
    if (!Array.isArray(value) && Object.keys(value as object).length === 1 && "__bn" in (value as object)) {
      try {
        return BigInt((value as { __bn: string }).__bn);
      } catch {
        return value;
      }
    }
    if (Array.isArray(value)) return value.map(reviveBn);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = reviveBn(v);
    return out;
  }
  return value;
}

function dumpBn(_k: string, v: unknown) {
  return typeof v === "bigint" ? { __bn: v.toString() } : v;
}

function estimate(value: unknown) {
  try {
    return JSON.stringify(value, dumpBn).length * 2;
  } catch {
    return 0;
  }
}

function idbAvailable() {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase | null> {
  if (!idbAvailable()) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, SCHEMA);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGetAll(): Promise<Good[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        const rows = (req.result as Good[] | undefined) ?? [];
        resolve(
          rows.map((r) => ({
            ...r,
            value: reviveBn(r.value),
          })),
        );
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function idbPut(row: Good) {
  const db = await openDb();
  if (!db) return;
  try {
    const payload: Good = {
      ...row,
      value: JSON.parse(JSON.stringify(row.value, dumpBn)),
    };
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.objectStore(STORE).put(payload);
    });
  } catch {
    /* quota / private */
  }
}

async function idbDelKeys(keys: string[]) {
  const db = await openDb();
  if (!db || !keys.length) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      const os = tx.objectStore(STORE);
      for (const k of keys) os.delete(k);
    });
  } catch {
    /* ignore */
  }
}

async function evictIfNeeded() {
  let bytes = 0;
  const persisted: Good[] = [];
  for (const g of good.values()) {
    if (!g.persist) continue;
    const n = estimate(g.value);
    bytes += n;
    persisted.push(g);
  }
  if (bytes <= BUDGET) return;
  persisted.sort((a, b) => a.at - b.at);
  const drop: string[] = [];
  for (const g of persisted) {
    if (bytes <= BUDGET) break;
    if (KEEP_CLASS.has(g.class)) continue;
    good.delete(g.key);
    drop.push(g.key);
    bytes -= estimate(g.value);
  }
  if (drop.length) await idbDelKeys(drop);
}

let hydrateJob: Promise<void> | null = null;

async function hydrate() {
  const rows = await idbGetAll();
  for (const r of rows) {
    if (!r?.key || r.value == null) continue;
    const cur = good.get(r.key);
    if (cur && cur.at >= r.at) continue;
    good.set(r.key, { ...r, persist: true, value: reviveBn(r.value) });
  }
  dbg("hydrate", rows.length);
}

export function cacheReady(): Promise<void> {
  if (!hydrateJob) hydrateJob = hydrate().catch(() => undefined);
  return hydrateJob;
}

void cacheReady();

function asRecord<T>(g: Good): CacheRecord<T> {
  return {
    key: g.key,
    at: g.at,
    freshUntil: g.freshUntil,
    staleUntil: g.staleUntil,
    value: g.value as T,
    cursor: g.cursor,
    scope: g.scope,
    account: g.account,
    class: g.class,
  };
}

export function cachePeek<T>(key: string): CacheRecord<T> | undefined {
  const g = good.get(key);
  return g ? asRecord<T>(g) : undefined;
}

export function cacheLastGood<T>(key: string): T | undefined {
  const g = good.get(key);
  return g ? (g.value as T) : undefined;
}

export function cacheFresh<T>(key: string): T | undefined {
  const g = good.get(key);
  if (!g) return undefined;
  if (now() >= g.freshUntil) return undefined;
  return g.value as T;
}

function recentNeg(key: string, policy: CachePolicy<unknown>) {
  const n = neg.get(key);
  if (!n) return undefined;
  const ttl = n.kind === "error" ? (policy.negTtlMs ?? NEG_TTL) : (policy.emptyTtlMs ?? EMPTY_TTL);
  if (now() - n.at >= ttl) {
    neg.delete(key);
    return undefined;
  }
  return n;
}

function writeGood<T>(key: string, policy: CachePolicy<T>, value: T, cursor?: string) {
  const at = now();
  const row: Good = {
    key,
    at,
    freshUntil: at + jitter(policy.ttlMs),
    staleUntil: at + policy.staleMs,
    value,
    cursor,
    scope: policy.scope,
    account: policy.account,
    class: policy.class,
    persist: persistable(policy as CachePolicy<unknown>),
  };
  good.set(key, row);
  neg.delete(key);
  if (row.persist) {
    void idbPut(row).then(() => evictIfNeeded());
  }
  dbg("ok", key, policy.class);
}

export function cacheWrite<T>(key: string, policy: CachePolicy<T>, value: T, cursor?: string) {
  if (!isKeep(policy, value)) return;
  writeGood(key, policy, value, cursor);
}

async function runFetch<T>(
  key: string,
  policy: CachePolicy<T>,
  fn: () => Promise<T>,
  cursor?: (value: T) => string | undefined,
): Promise<T> {
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const job = (async () => {
    try {
      const value = await fn();
      if (!isKeep(policy, value)) {
        neg.set(key, { at: now(), kind: "empty", value });
        const last = good.get(key);
        dbg("empty", key, Boolean(last));
        return last ? (last.value as T) : value;
      }
      writeGood(key, policy, value, cursor?.(value));
      return value;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "rpc";
      neg.set(key, { at: now(), kind: "error", err: msg });
      const last = good.get(key);
      dbg("error", key, msg, Boolean(last));
      if (last) return last.value as T;
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, job);
  return job;
}

export type CacheGetOpts<T> = {
  key: string;
  policy: CachePolicy<T>;
  cursor?: (value: T) => string | undefined;
};

export async function cacheGet<T>(opts: CacheGetOpts<T>, fn: () => Promise<T>): Promise<T> {
  await cacheReady();
  const { key, policy } = opts;
  const g = good.get(key);
  if (g && now() < g.freshUntil) {
    dbg("fresh", key);
    return g.value as T;
  }
  const n = recentNeg(key, policy as CachePolicy<unknown>);
  if (n?.kind === "empty") return (g ? g.value : n.value) as T;
  if (n?.kind === "error") {
    if (g) return g.value as T;
    throw new Error(n.err || "rpc");
  }
  return runFetch(key, policy, fn, opts.cursor);
}

export async function cacheGetSWR<T>(opts: CacheGetOpts<T>, fn: () => Promise<T>, onUpdate?: (value: T) => void): Promise<T> {
  await cacheReady();
  const { key, policy } = opts;
  const g = good.get(key);
  if (g) {
    if (now() >= g.freshUntil) {
      void runFetch(key, policy, fn, opts.cursor).then((v) => {
        if (v !== g.value) onUpdate?.(v);
      });
    }
    dbg(now() < g.freshUntil ? "fresh" : "stale", key);
    return g.value as T;
  }
  const n = recentNeg(key, policy as CachePolicy<unknown>);
  if (n?.kind === "empty") return n.value as T;
  if (n?.kind === "error") throw new Error(n.err || "rpc");
  return runFetch(key, policy, fn, opts.cursor);
}

export function cacheInvalidate(prefixOrKey: string) {
  const keys: string[] = [];
  for (const k of [...good.keys()]) {
    if (k === prefixOrKey || k.startsWith(prefixOrKey)) {
      good.delete(k);
      keys.push(k);
    }
  }
  for (const k of [...neg.keys()]) {
    if (k === prefixOrKey || k.startsWith(prefixOrKey)) neg.delete(k);
  }
  for (const k of [...inflight.keys()]) {
    if (k === prefixOrKey || k.startsWith(prefixOrKey)) inflight.delete(k);
  }
  if (keys.length) void idbDelKeys(keys);
  dbg("invalidate", prefixOrKey, keys.length);
}

export function cacheInvalidateAccount(account: string) {
  const a = account.toLowerCase();
  const keys: string[] = [];
  for (const [k, g] of [...good.entries()]) {
    if (g.scope === "account" && (g.account === a || k.includes(a))) {
      good.delete(k);
      keys.push(k);
    }
  }
  for (const [k, n] of [...neg.entries()]) {
    if (k.includes(a)) neg.delete(k);
    void n;
  }
  dbg("invalidate-account", a, keys.length);
}

export function cacheDropAccountRam() {
  for (const [k, g] of [...good.entries()]) {
    if (g.scope === "account") good.delete(k);
  }
  dbg("drop-account-ram");
}

export function onVisibleInterval(ms: number, fn: () => void): () => void {
  if (typeof document === "undefined") return () => undefined;
  const tick = () => {
    if (!document.hidden) fn();
  };
  const id = window.setInterval(tick, ms);
  const vis = () => {
    if (document.visibilityState === "visible") fn();
  };
  document.addEventListener("visibilitychange", vis);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", vis);
  };
}

export const POLICIES = {
  markets: { class: "markets", ttlMs: 60_000, staleMs: 600_000, persist: true, scope: "global" as const },
  catalog: { class: "catalog", ttlMs: 10 * 60_000, staleMs: 60 * 60_000, persist: true, scope: "global" as const },
  quote: { class: "quote", ttlMs: 30_000, staleMs: 180_000, persist: false, scope: "global" as const },
  meta: { class: "meta", ttlMs: 7 * 86_400_000, staleMs: 30 * 86_400_000, persist: true, scope: "global" as const },
  venues: { class: "venues", ttlMs: 60_000, staleMs: 600_000, persist: true, scope: "global" as const },
  swaps: { class: "swaps", ttlMs: 30_000, staleMs: 600_000, persist: true, scope: "global" as const },
  account: { class: "account", ttlMs: 15_000, staleMs: 60_000, persist: false, scope: "account" as const },
  ens: { class: "ens", ttlMs: 86_400_000, staleMs: 7 * 86_400_000, persist: true, scope: "global" as const },
  lpfeed: { class: "lpfeed", ttlMs: 60_000, staleMs: 3_600_000, persist: true, scope: "global" as const },
  http: { class: "http", ttlMs: 30_000, staleMs: 180_000, persist: false, scope: "global" as const },
};

/** @deprecated thin wrapper — prefer cacheGet */
export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>, keep?: (value: T) => boolean): Promise<T> {
  return cacheGet(
    {
      key,
      policy: {
        class: key.split(":")[0] ?? "legacy",
        ttlMs,
        staleMs: ttlMs,
        persist: false,
        keep,
        scope: "global",
      },
    },
    fn,
  );
}

export async function mapChunk<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const part = await Promise.all(items.slice(i, size + i).map(fn));
    out.push(...part);
  }
  return out;
}

export async function forChunks<T>(items: T[], size: number, fn: (chunk: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size));
  }
}
