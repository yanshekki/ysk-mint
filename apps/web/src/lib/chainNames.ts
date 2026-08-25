import { useEffect, useState } from "react";
import { useEnsName } from "wagmi";
import type { Address } from "viem";
import { stakeFromPayment } from "./cardanoCip30.ts";

export function useEvmName(address?: string) {
  const { data } = useEnsName({
    address: address as Address | undefined,
    chainId: 1,
    query: { enabled: Boolean(address) },
  });
  return data ?? "";
}

export function useAdaHandle(address: string, stake: string) {
  const [name, setName] = useState("");
  const key = stake || (address ? stakeFromPayment(address) : "");
  useEffect(() => {
    if (!key.startsWith("stake")) {
      setName("");
      return;
    }
    let cancelled = false;
    void fetch(`https://api.handle.me/holders/${encodeURIComponent(key)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { default_handle?: string; handles?: string[] } | null) => {
        const handle = json?.default_handle || json?.handles?.[0];
        if (!cancelled) setName(handle ? `$${handle}` : "");
      })
      .catch(() => {
        if (!cancelled) setName("");
      });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return name;
}

export function useSolName(address: string) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (!address) {
      setName("");
      return;
    }
    let cancelled = false;
    void lookupSolName(address).then((found) => {
      if (!cancelled) setName(found);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);
  return name;
}

async function lookupSolName(address: string): Promise<string> {
  const urls = [
    `https://sns-api.bonfida.com/v2/user/${address}`,
    `https://sns-api.bonfida.com/favorite-domain/${address}`,
    `https://api.sns.id/domains/${address}`,
    `https://lite-api.jup.ag/v1/sns/${address}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json: unknown = await res.json();
      const found = pickSolName(json, address);
      if (found) return found.endsWith(".sol") ? found : `${found}.sol`;
    } catch {
      /* try next */
    }
  }
  return "";
}

function pickSolName(json: unknown, address: string): string {
  if (!json || typeof json !== "object") return "";
  const o = json as Record<string, unknown>;
  const direct = [o.domain, o.name, o.favorite, o.primary, o.result];
  for (const v of direct) {
    if (typeof v === "string" && v && v !== address) return v.replace(/^\./, "");
  }
  if (o.data && typeof o.data === "object") return pickSolName(o.data, address);
  const domains = o.domains ?? o.items;
  if (Array.isArray(domains) && typeof domains[0] === "string") return domains[0];
  if (Array.isArray(domains) && domains[0] && typeof domains[0] === "object") {
    const first = domains[0] as Record<string, unknown>;
    if (typeof first.name === "string") return first.name;
    if (typeof first.domain === "string") return first.domain;
  }
  return "";
}
