import type { ChainDefinition } from "@ysk-mint/config";
import { RPC_PROVIDER_LABEL } from "../../lib/rpcCatalog.ts";

export function rpcProvLabel(id: string, t: (k: string) => string) {
  if (id === "official") return t("settings.rpcProvOfficial");
  if (id === "publicnode") return t("settings.rpcProvPublicnode");
  if (id === "oneRpc") return t("settings.rpcProvOneRpc");
  if (id === "drpc") return t("settings.rpcProvDrpc");
  return RPC_PROVIDER_LABEL[id] ?? id;
}

export function rpcBadgeLabel(badge: string, t: (k: string) => string) {
  if (badge === "Random") return t("settings.rpcRandom");
  if (badge === "Official") return t("settings.rpcProvOfficial");
  if (badge === "Custom") return t("settings.rpcCustom");
  if (badge === "PublicNode") return t("settings.rpcProvPublicnode");
  if (badge === "1RPC") return t("settings.rpcProvOneRpc");
  if (badge === "dRPC") return t("settings.rpcProvDrpc");
  return badge;
}

export function rpcHost(url: string) {
  try {
    const u = new URL(url, typeof location !== "undefined" ? location.href : "https://local.invalid");
    return u.host || u.pathname;
  } catch {
    return url;
  }
}

export function chainHits(c: ChainDefinition, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    c.name.toLowerCase().includes(needle) ||
    c.short.toLowerCase().includes(needle) ||
    c.nativeSymbol.toLowerCase().includes(needle) ||
    String(c.chainId) === needle
  );
}
