import { useEffect, useState } from "react";
import { stakeFromPayment } from "./cardanoCip30.ts";

type BioDomain = { identity?: string; platform?: string; isPrimary?: boolean };

async function web3BioName(address: string, platform: "ens" | "sns"): Promise<string> {
  const res = await fetch(`https://api.web3.bio/domain/${encodeURIComponent(address)}`);
  if (!res.ok) return "";
  const json = (await res.json()) as { domains?: BioDomain[] };
  const hits = (json.domains ?? []).filter((d) => d.platform === platform && d.identity);
  const pick = hits.find((d) => d.isPrimary) ?? hits[0];
  return pick?.identity ?? "";
}

async function ensFromGraph(address: string): Promise<string> {
  const id = address.toLowerCase();
  const res = await fetch("https://api.thegraph.com/subgraphs/name/ensdomains/ens", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `{ domains(first: 5, where: { resolvedAddress: "${id}" }) { name } }`,
    }),
  });
  if (!res.ok) return "";
  const json = (await res.json()) as { data?: { domains?: Array<{ name?: string }> } };
  const names = (json.data?.domains ?? []).map((d) => d.name).filter((n): n is string => Boolean(n?.endsWith(".eth")));
  return names[0] ?? "";
}

export function useEvmName(address?: string) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (!address) {
      setName("");
      return;
    }
    let cancelled = false;
    void (async () => {
      const fromBio = await web3BioName(address, "ens").catch(() => "");
      const found = fromBio || (await ensFromGraph(address).catch(() => ""));
      if (!cancelled) setName(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);
  return name;
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
    void web3BioName(address, "sns")
      .then((found) => {
        if (!cancelled) setName(found);
      })
      .catch(() => {
        if (!cancelled) setName("");
      });
    return () => {
      cancelled = true;
    };
  }, [address]);
  return name;
}
