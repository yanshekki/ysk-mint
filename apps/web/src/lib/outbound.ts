import { useUserSettings } from "./userSettings.ts";

export const MIN_OUTBOUND = 1;
export const MAX_OUTBOUND = 32;
export const DEFAULT_MAX_OUTBOUND = 10;
export const DEFAULT_MAX_OUTBOUND_PER_HOST = 2;

const HOST_BACKOFF_MIN = 2_000;
const HOST_BACKOFF_MAX = 8_000;
const HOST_429_TRIES = 3;

type Waiter = {
  host: string;
  resolve: () => void;
  reject: (err: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
};

let inflight = 0;
const perHost = new Map<string, number>();
const waiters: Waiter[] = [];
const cooldownUntil = new Map<string, number>();
const backoffMs = new Map<string, number>();
const cooldownTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function clampMaxOutbound(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(typeof raw === "string" ? raw.trim() : raw);
  if (!Number.isFinite(n)) return DEFAULT_MAX_OUTBOUND;
  return Math.min(MAX_OUTBOUND, Math.max(MIN_OUTBOUND, Math.round(n)));
}

export function clampMaxOutboundPerHost(raw: unknown, global = clampMaxOutbound(DEFAULT_MAX_OUTBOUND)): number {
  const cap = clampMaxOutbound(global);
  const n = typeof raw === "number" ? raw : Number(typeof raw === "string" ? raw.trim() : raw);
  if (!Number.isFinite(n)) return Math.min(DEFAULT_MAX_OUTBOUND_PER_HOST, cap);
  return Math.min(cap, Math.max(MIN_OUTBOUND, Math.round(n)));
}

function limits() {
  const s = useUserSettings.getState();
  const global = clampMaxOutbound(s.maxOutbound);
  return { global, perHost: clampMaxOutboundPerHost(s.maxOutboundPerHost, global) };
}

function hostCount(host: string) {
  return perHost.get(host) ?? 0;
}

function cooling(host: string) {
  return Date.now() < (cooldownUntil.get(host) ?? 0);
}

function canRun(host: string) {
  if (cooling(host)) return false;
  const { global, perHost: hostCap } = limits();
  if (inflight >= global) return false;
  if (hostCount(host) >= hostCap) return false;
  return true;
}

function abortError(signal?: AbortSignal) {
  if (signal?.reason instanceof Error) return signal.reason;
  if (typeof DOMException !== "undefined") return new DOMException("The operation was aborted.", "AbortError");
  const err = new Error("The operation was aborted.");
  err.name = "AbortError";
  return err;
}

function schedulePump(host: string) {
  const left = (cooldownUntil.get(host) ?? 0) - Date.now();
  if (left <= 0) return;
  const prev = cooldownTimers.get(host);
  if (prev) globalThis.clearTimeout(prev);
  const id = globalThis.setTimeout(() => {
    cooldownTimers.delete(host);
    pump();
  }, left + 1);
  cooldownTimers.set(host, id);
}

let snap = { inflight: 0, waiters: 0, global: DEFAULT_MAX_OUTBOUND, perHost: DEFAULT_MAX_OUTBOUND_PER_HOST };
const outboundListeners = new Set<() => void>();

function refreshSnap() {
  const lim = limits();
  if (snap.inflight === inflight && snap.waiters === waiters.length && snap.global === lim.global && snap.perHost === lim.perHost) return false;
  snap = { inflight, waiters: waiters.length, global: lim.global, perHost: lim.perHost };
  return true;
}

function notifyOutbound() {
  if (!refreshSnap()) return;
  for (const fn of outboundListeners) fn();
}

export function subscribeOutbound(onStoreChange: () => void) {
  outboundListeners.add(onStoreChange);
  refreshSnap();
  return () => {
    outboundListeners.delete(onStoreChange);
  };
}

export function getOutboundSnapshot() {
  return snap;
}

export function hostIsCooling(url: string) {
  try {
    return cooling(hostOf(url));
  } catch {
    return false;
  }
}

function pump() {
  for (let i = 0; i < waiters.length; i++) {
    const w = waiters[i]!;
    if (!canRun(w.host)) {
      if (cooling(w.host)) schedulePump(w.host);
      continue;
    }
    waiters.splice(i, 1);
    i -= 1;
    if (w.onAbort && w.signal) w.signal.removeEventListener("abort", w.onAbort);
    inflight += 1;
    perHost.set(w.host, hostCount(w.host) + 1);
    w.resolve();
  }
  notifyOutbound();
}

function take(host: string) {
  inflight += 1;
  perHost.set(host, hostCount(host) + 1);
  notifyOutbound();
}

function release(host: string) {
  inflight = Math.max(0, inflight - 1);
  const n = hostCount(host) - 1;
  if (n <= 0) perHost.delete(host);
  else perHost.set(host, n);
  pump();
  notifyOutbound();
}

function acquire(host: string, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError(signal));
  if (canRun(host)) {
    take(host);
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const w: Waiter = { host, resolve, reject, signal };
    const onAbort = () => {
      const idx = waiters.indexOf(w);
      if (idx >= 0) {
        waiters.splice(idx, 1);
        notifyOutbound();
      }
      reject(abortError(signal));
    };
    w.onAbort = onAbort;
    signal?.addEventListener("abort", onAbort, { once: true });
    waiters.push(w);
    notifyOutbound();
    if (cooling(host)) schedulePump(host);
  });
}

function markCooldown(host: string) {
  const wait = Math.min(HOST_BACKOFF_MAX, backoffMs.get(host) ?? HOST_BACKOFF_MIN);
  backoffMs.set(host, Math.min(HOST_BACKOFF_MAX, wait * 2));
  cooldownUntil.set(host, Date.now() + wait);
  schedulePump(host);
  return wait;
}

function clearBackoff(host: string) {
  backoffMs.delete(host);
  cooldownUntil.delete(host);
  const t = cooldownTimers.get(host);
  if (t) {
    globalThis.clearTimeout(t);
    cooldownTimers.delete(host);
  }
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(abortError(signal));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function hostOf(url: string): string {
  const base = typeof location !== "undefined" ? location.href : "http://localhost";
  return new URL(url, base).host;
}

function shouldBypass(url: string): boolean {
  try {
    const base = typeof location !== "undefined" ? location.href : "http://localhost";
    const u = new URL(url, base);
    if (u.port === "7877") return true;
    if (u.pathname.includes("/ingest/")) return true;
    return false;
  } catch {
    return false;
  }
}

async function bufferedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  const buf = await res.arrayBuffer();
  return new Response(buf, { status: res.status, statusText: res.statusText, headers: res.headers });
}

export type OutboundInit = RequestInit & { failoverOn429?: boolean };

export async function outboundFetch(input: RequestInfo | URL, init?: OutboundInit): Promise<Response> {
  const { failoverOn429, ...req } = init ?? {};
  const url = requestUrl(input);
  if (shouldBypass(url)) return fetch(input, req);

  const host = hostOf(url);
  const signal = req.signal ?? (input instanceof Request ? input.signal : undefined);
  let tries = 0;

  for (;;) {
    await acquire(host, signal ?? undefined);
    try {
      const out = await bufferedFetch(input, req);
      if (out.status === 429) {
        const wait = markCooldown(host);
        release(host);
        if (failoverOn429) throw new Error("rpc 429");
        if (tries < HOST_429_TRIES) {
          tries += 1;
          await sleep(wait, signal ?? undefined);
          continue;
        }
        return out;
      }
      clearBackoff(host);
      release(host);
      return out;
    } catch (err) {
      release(host);
      throw err;
    }
  }
}

if (typeof window !== "undefined") {
  useUserSettings.subscribe((s, prev) => {
    if (s.maxOutbound !== prev.maxOutbound || s.maxOutboundPerHost !== prev.maxOutboundPerHost) {
      notifyOutbound();
      pump();
    }
  });
}
