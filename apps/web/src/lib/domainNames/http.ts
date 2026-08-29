import { cacheGet, cacheKey, POLICIES } from "../defi/cache.ts";
import { outboundFetch } from "../outbound.ts";

const ENS_POLICY = { ...POLICIES.ens, keep: () => true };

export function domainCache<T>(extra: string, fn: () => Promise<T>): Promise<T> {
  return cacheGet({ key: cacheKey("ens", 0, extra), policy: ENS_POLICY }, fn);
}

export async function jsonGet<T>(url: string, init?: RequestInit): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await outboundFetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function jsonPost<T>(url: string, body: unknown): Promise<T | null> {
  return jsonGet<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function cleanName(raw: string) {
  return raw.trim().replace(/^@/, "");
}

export function stripTld(name: string, tld: string) {
  const n = name.trim().toLowerCase();
  const t = tld.startsWith(".") ? tld : `.${tld}`;
  return n.endsWith(t) ? n.slice(0, -t.length) : n;
}
