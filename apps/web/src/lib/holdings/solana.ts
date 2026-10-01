import { useEffect, useMemo, useState } from "react";
import { cacheGet, cacheHash, cacheKey, mapChunk, POLICIES } from "../defi/cache.ts";
import { solByMint, tokensFor } from "../tokenRegistry.ts";
import { outboundFetch } from "../outbound.ts";
import { rpcJsonRpc } from "../rpcPool.ts";
import { encodeB58, findAta, TOKEN_2022_PROGRAM, TOKEN_PROGRAM } from "../solanaPda.ts";
import { syncLiveFlag, useLiveStatus } from "../liveStatus.ts";
import { useHoldingsRefreshEpoch } from "../quoteRefresh.ts";
import { addrList, fmt, row, sortHoldings, type HoldingRow } from "./shared.ts";

const META_CAP = 40;
const MULTI_CAP = 100;

type MintBal = { raw: bigint; decimals: number };
type TokenAmt = { amount?: string; decimals?: number };
type ParsedInfo = { mint?: string; tokenAmount?: TokenAmt };
type ParsedData = { parsed?: { info?: ParsedInfo } };
type AccData = ParsedData | [string, string];

type SolTokJson = {
  value?: Array<{
    account?: { data?: ParsedData };
  }>;
};

type MultiJson = { value?: Array<{ data?: AccData } | null> };

function addMint(into: Map<string, MintBal>, mint: string, raw: bigint, decimals: number) {
  if (!mint) return;
  const prev = into.get(mint);
  into.set(mint, {
    raw: (prev?.raw ?? 0n) + raw,
    decimals: decimals || prev?.decimals || 0,
  });
}

function fromParsed(info: ParsedInfo | undefined, into: Map<string, MintBal>) {
  if (!info?.mint) return;
  let raw = 0n;
  try {
    raw = BigInt(info.tokenAmount?.amount ?? "0");
  } catch {
    return;
  }
  addMint(into, info.mint, raw, info.tokenAmount?.decimals ?? 0);
}

function fromBase64(b64: string, into: Map<string, MintBal>) {
  try {
    const bin = atob(b64);
    if (bin.length < 72) return;
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const mint = encodeB58(bytes.subarray(0, 32));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    addMint(into, mint, view.getBigUint64(64, true), 0);
  } catch {
    /* skip */
  }
}

function collectMints(json: SolTokJson, into: Map<string, MintBal>) {
  for (const v of json.value ?? []) fromParsed(v.account?.data?.parsed?.info, into);
}

function collectAccounts(json: MultiJson, into: Map<string, MintBal>) {
  for (const acc of json.value ?? []) {
    const data = acc?.data;
    if (!data) continue;
    if (Array.isArray(data)) fromBase64(data[0] ?? "", into);
    else fromParsed(data.parsed?.info, into);
  }
}

async function solMintMeta(mint: string): Promise<{ symbol: string; name: string } | null> {
  const ctrl = new AbortController();
  const timer = globalThis.setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await outboundFetch(`https://lite-api.jup.ag/tokens/v1/token/${mint}`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { symbol?: string; name?: string };
    if (!json.symbol) return null;
    return { symbol: json.symbol, name: json.name || json.symbol };
  } catch {
    return null;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

async function solanaCall<T>(body: { method: string; params: unknown }): Promise<T> {
  return cacheGet(
    {
      key: cacheKey("hold.sol", 101, cacheHash(JSON.stringify(body))),
      policy: POLICIES.account,
    },
    () => rpcJsonRpc<T>(101, body.method, body.params),
  );
}

async function scanProgram(address: string, programId: string): Promise<Map<string, MintBal>> {
  const into = new Map<string, MintBal>();
  const json = await solanaCall<SolTokJson>({
    method: "getTokenAccountsByOwner",
    params: [address, { programId }, { encoding: "jsonParsed" as const }],
  });
  collectMints(json, into);
  return into;
}

/** PublicNode 403s getTokenAccountsByOwner; getMultipleAccounts on ATAs still works. */
async function scanCatalogAtas(address: string, skip: Set<string>): Promise<Map<string, MintBal>> {
  const into = new Map<string, MintBal>();
  const mints = tokensFor("solana", 101)
    .map((t) => t.address)
    .filter((a): a is string => typeof a === "string" && a.length > 0 && !skip.has(a));
  if (!mints.length) return into;
  const keys: string[] = [];
  await Promise.all(
    mints.flatMap((mint) =>
      [TOKEN_PROGRAM, TOKEN_2022_PROGRAM].map(async (program) => {
        const ata = await findAta(address, mint, program);
        if (ata) keys.push(ata);
      }),
    ),
  );
  for (let i = 0; i < keys.length; i += MULTI_CAP) {
    const chunk = keys.slice(i, i + MULTI_CAP);
    try {
      const json = await solanaCall<MultiJson>({
        method: "getMultipleAccounts",
        params: [chunk, { encoding: "jsonParsed" as const }],
      });
      collectAccounts(json, into);
    } catch {
      /* chunk miss */
    }
  }
  return into;
}

function mergeMints(parts: Array<Map<string, MintBal>>): Map<string, MintBal> {
  const into = new Map<string, MintBal>();
  for (const part of parts) {
    for (const [mint, bal] of part) {
      const prev = into.get(mint);
      if (!prev || bal.raw > prev.raw) into.set(mint, bal);
    }
  }
  return into;
}

export async function fetchSolana(address: string) {
  const balJson = await solanaCall<{ value?: number }>({ method: "getBalance", params: [address] });
  if (typeof balJson.value !== "number") throw new Error("solana getBalance");
  const lamports = balJson.value;
  const [legacy, token2022] = await Promise.all([
    scanProgram(address, TOKEN_PROGRAM).catch(() => new Map<string, MintBal>()),
    scanProgram(address, TOKEN_2022_PROGRAM).catch(() => new Map<string, MintBal>()),
  ]);
  const scanned = mergeMints([legacy, token2022]);
  const funded = new Set([...scanned].filter(([, bal]) => bal.raw > 0n).map(([mint]) => mint));
  const atas = await scanCatalogAtas(address, funded);
  return { lamports, byMint: mergeMints([scanned, atas]) };
}

export function useSolanaHoldings(address: string | string[]) {
  const catalog = useMemo(() => tokensFor("solana", 101), []);
  const [rows, setRows] = useState<HoldingRow[]>(() => catalog.map((t) => row(t, null, false)));
  const [loading, setLoading] = useState(false);
  const accKey = Array.isArray(address) ? address.join("|") : address;
  const addrs = useMemo(() => addrList(address), [accKey]);
  const connected = addrs.length > 0;
  const refresh = useHoldingsRefreshEpoch();

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
        setRows(sortHoldings(next, true));
        if (!cancelled) setLoading(false);
        const known = new Set(catalog.map((t) => t.address).filter(Boolean));
        const extras = [...byMint.entries()].filter(([mint, bal]) => !known.has(mint) && bal.raw > 0n && bal.decimals !== 0);
        const meta = await mapChunk(extras.slice(0, META_CAP), 8, ([mint]) => solMintMeta(mint));
        if (cancelled) return;
        extras.forEach(([mint, bal], i) => {
          const listed = solByMint(mint);
          const info = i < meta.length ? meta[i] : null;
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
            decimals: bal.decimals,
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
  }, [accKey, addrs, catalog, refresh]);

  const funded = rows.filter((r) => r.raw > 0n).length;
  useEffect(() => {
    syncLiveFlag("holdings:101", 101, "holdings", connected && loading);
    return () => useLiveStatus.getState().finish("holdings:101", true);
  }, [connected, loading]);
  return { rows, funded, loading, catalogSize: catalog.length };
}
