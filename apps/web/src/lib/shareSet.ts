import { useEffect, useState } from "react";
import type { AddrKind } from "./addrKind.ts";

export const SHARE_SOFT = 1800;

const KIND_CODE: Record<AddrKind, string> = {
  evm: "e",
  near: "n",
  cardano: "c",
  solana: "s",
  tron: "t",
  sui: "u",
  ton: "o",
  aptos: "p",
  bitcoin: "b",
  xrpl: "x",
  stellar: "l",
  cosmos: "m",
  osmosis: "z",
  celestia: "d",
  starknet: "k",
};

const CODE_KIND = Object.fromEntries(Object.entries(KIND_CODE).map(([k, v]) => [v, k])) as Record<string, AddrKind>;

export type SharePayload = {
  name: string;
  addrs: Array<{ kind: AddrKind; value: string }>;
};

function b64url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeWatch(payload: SharePayload): string {
  const lines = [`v1`, payload.name.replace(/[\n\r]/g, " ").slice(0, 40)];
  for (const a of payload.addrs) {
    const code = KIND_CODE[a.kind];
    if (!code || !a.value) continue;
    lines.push(`${code}:${a.value}`);
  }
  const body = b64url(new TextEncoder().encode(lines.join("\n")));
  return `v1.${body}`;
}

export function decodeWatch(raw: string): SharePayload | null {
  const hash = raw.startsWith("#") ? raw.slice(1) : raw;
  const q = hash.startsWith("w=") ? hash.slice(2) : hash;
  const m = /^v1\.([A-Za-z0-9_-]+)$/.exec(q.trim());
  if (!m?.[1]) return null;
  let text = "";
  try {
    text = new TextDecoder().decode(unb64url(m[1]));
  } catch {
    return null;
  }
  const [ver, name, ...rows] = text.split("\n");
  if (ver !== "v1" || !name) return null;
  const addrs: SharePayload["addrs"] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const i = row.indexOf(":");
    if (i < 1) continue;
    const kind = CODE_KIND[row.slice(0, i)];
    const value = row.slice(i + 1).trim();
    if (!kind || !value) continue;
    const k = `${kind}:${value.toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    addrs.push({ kind, value });
    if (addrs.length >= 8) break;
  }
  if (!addrs.length) return null;
  return { name: name.slice(0, 40), addrs };
}

export function shareUrl(payload: SharePayload, origin = typeof window !== "undefined" ? window.location.origin : ""): string {
  return `${origin}/me#w=${encodeWatch(payload)}`;
}

export function applyPeekHash(payload: SharePayload | null, opts?: { push?: boolean }) {
  if (typeof window === "undefined") return;
  const path = `${window.location.pathname}${window.location.search}`;
  const next = payload?.addrs.length ? `${path}#w=${encodeWatch(payload)}` : path;
  const state = { yskPeek: Boolean(opts?.push && payload?.addrs.length) };
  if (opts?.push) window.history.pushState(state, "", next);
  else window.history.replaceState({ yskPeek: false }, "", next);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function peekGoBack() {
  if (typeof window === "undefined") return;
  window.history.back();
}

export function usePeekBack() {
  const [canBack, setCanBack] = useState(() =>
    typeof window === "undefined" ? false : Boolean((window.history.state as { yskPeek?: boolean } | null)?.yskPeek),
  );
  useEffect(() => {
    const sync = () => setCanBack(Boolean((window.history.state as { yskPeek?: boolean } | null)?.yskPeek));
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);
  return canBack;
}

export function usePeekHash(): SharePayload | null {
  const [peek, setPeek] = useState<SharePayload | null>(() =>
    typeof window === "undefined" ? null : decodeWatch(window.location.hash),
  );
  useEffect(() => {
    const sync = () => setPeek(decodeWatch(window.location.hash));
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  return peek;
}

export function fingerprint(addrs: Array<{ kind: AddrKind; value: string }>) {
  return addrs
    .map((a) => `${a.kind}:${a.value.trim().toLowerCase()}`)
    .sort()
    .join("|");
}
