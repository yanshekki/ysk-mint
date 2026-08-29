import { useEffect, useMemo, useState } from "react";
import { cacheGet, cacheHash, cacheKey, POLICIES } from "../defi/cache.ts";
import { solByMint, tokensFor } from "../tokenRegistry.ts";
import { outboundFetch } from "../outbound.ts";
import { rpcJsonRpc } from "../rpcPool.ts";
import { syncLiveFlag, useLiveStatus } from "../liveStatus.ts";
import { addrList, fmt, row, sortHoldings, type HoldingRow } from "./shared.ts";

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

type SolTokJson = {
  value?: Array<{
    account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { amount?: string; decimals?: number } } } } };
  }>;
};

async function solMintMeta(mint: string): Promise<{ symbol: string; name: string } | null> {
  try {
    const res = await outboundFetch(`https://lite-api.jup.ag/tokens/v1/token/${mint}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { symbol?: string; name?: string };
    if (!json.symbol) return null;
    return { symbol: json.symbol, name: json.name || json.symbol };
  } catch {
    return null;
  }
}

async function solanaCall<T>(body: { method: string; params: unknown }): Promise<T | null> {
  return cacheGet(
    {
      key: cacheKey("hold.sol", 101, cacheHash(JSON.stringify(body))),
      policy: POLICIES.account,
    },
    async () => {
      try {
        return await rpcJsonRpc<T>(101, body.method, body.params);
      } catch {
        return null;
      }
    },
  );
}

function collectMints(json: SolTokJson | null, into: Map<string, { raw: bigint; decimals: number }>) {
  for (const v of json?.value ?? []) {
    const info = v.account?.data?.parsed?.info;
    if (!info?.mint) continue;
    const raw = BigInt(info.tokenAmount?.amount ?? "0");
    const prev = into.get(info.mint);
    into.set(info.mint, {
      raw: (prev?.raw ?? 0n) + raw,
      decimals: info.tokenAmount?.decimals ?? prev?.decimals ?? 0,
    });
  }
}

async function fetchSolana(address: string) {
  let lamports: number | null = null;
  const byMint = new Map<string, { raw: bigint; decimals: number }>();
  const balJson = await solanaCall<{ value?: number }>({ method: "getBalance", params: [address] });
  if (typeof balJson?.value === "number") lamports = balJson.value;
  const tokenParams = (programId: string) => [address, { programId }, { encoding: "jsonParsed" as const }];
  collectMints(await solanaCall<SolTokJson>({ method: "getTokenAccountsByOwner", params: tokenParams(TOKEN_PROGRAM) }), byMint);
  collectMints(await solanaCall<SolTokJson>({ method: "getTokenAccountsByOwner", params: tokenParams(TOKEN_2022_PROGRAM) }), byMint);
  return { lamports, byMint };
}

export function useSolanaHoldings(address: string | string[]) {
  const catalog = useMemo(() => tokensFor("solana", 101), []);
  const [rows, setRows] = useState<HoldingRow[]>(() => catalog.map((t) => row(t, null, false)));
  const [loading, setLoading] = useState(false);
  const accKey = Array.isArray(address) ? address.join("|") : address;
  const addrs = useMemo(() => addrList(address), [accKey]);
  const connected = addrs.length > 0;

  useEffect(() => {
    if (!addrs.length) {
      setRows(catalog.map((t) => row(t, null, false)));
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        let lamports = 0;
        const byMint = new Map<string, { raw: bigint; decimals: number }>();
        let any = false;
        for (const addr of addrs) {
          const part = await fetchSolana(addr);
          if (part.lamports != null) {
            lamports += part.lamports;
            any = true;
          }
          for (const [mint, bal] of part.byMint) {
            const prev = byMint.get(mint);
            byMint.set(mint, { raw: (prev?.raw ?? 0n) + bal.raw, decimals: bal.decimals ?? prev?.decimals ?? 0 });
            any = true;
          }
        }
        if (!any) throw new Error("solana rpc");
        if (cancelled) return;
        const next = catalog.map((t) => {
          const raw = t.native ? BigInt(lamports) : (byMint.get(t.address ?? "")?.raw ?? 0n);
          return row(t, raw, true);
        });
        const known = new Set(catalog.map((t) => t.address).filter(Boolean));
        const extras = [...byMint.entries()].filter(([mint, bal]) => !known.has(mint) && bal.raw > 0n);
        const meta = await Promise.all(extras.map(([mint]) => solMintMeta(mint)));
        extras.forEach(([mint, bal], i) => {
          const listed = solByMint(mint);
          const info = meta[i];
          next.push({
            id: `sol-${mint}`,
            symbol: listed?.symbol || info?.symbol || mint.slice(0, 4).toUpperCase(),
            name: listed?.name || info?.name || mint,
            icon: listed?.icon || "/tokens/sol.png",
            amount: fmt(bal.raw, bal.decimals),
            raw: bal.raw,
            contract: mint,
            chainTag: "SOL",
            chainId: 101,
          });
        });
        setRows(sortHoldings(next, true));
      } catch {
        if (!cancelled) setRows(catalog.map((t) => row(t, null, true)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accKey, addrs, catalog]);

  const funded = rows.filter((r) => r.raw > 0n).length;
  useEffect(() => {
    syncLiveFlag("holdings:101", 101, "holdings", connected && loading);
    return () => useLiveStatus.getState().finish("holdings:101", true);
  }, [connected, loading]);
  return { rows, funded, loading, catalogSize: catalog.length };
}
