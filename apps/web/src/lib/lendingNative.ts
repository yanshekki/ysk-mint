import { formatUnits } from "viem";
import type { Quote } from "./defiQuotes.ts";
import type { LendCard } from "./lendingExtra.ts";
import type { ProtocolLine } from "./defiPositions.ts";

const RAY = 10n ** 27n;
const SOL_NATIVE = "So11111111111111111111111111111111111111112";
const SUI_RPCS = ["https://rpc-mainnet.suiscan.xyz", "https://sui-rpc.publicnode.com", "https://sui-mainnet-endpoint.blockvision.org"];
const NAVI_STORAGE_USERS = "0xabc6c3fbc89b96e3351fdbeb5730bcc5398648367260c6a4e201779e34694e04";
const NAVI_RESERVES = "0xe6d4c6610b86ce7735ea754596d71d72d10c7980b5052fc3c8cdf8d09fea9b4b";
const SUILEND_PKG = "0xf95b06141ed4a174f239417323bde3f209b972f5930d8521ea38a52aff3a6ddf";
const SUILEND_CAPS = [
  `${SUILEND_PKG}::lending_market::ObligationOwnerCap<${SUILEND_PKG}::suilend::MAIN_POOL>`,
  `${SUILEND_PKG}::lending_market::ObligationOwnerCap<0x0a071f4976abae1a7f722199cf0bfcbe695ef9408a878e7d12a7ca87b7e582a6::lp_rewards::LP_REWARDS>`,
];

type Json = Record<string, unknown>;

function fmtAmt(raw: bigint, decimals: number) {
  const n = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(n)) return formatUnits(raw, decimals);
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function iconOf(symbol: string) {
  const s = symbol.toLowerCase();
  if (s.includes("btc")) return "/tokens/wbtc.png";
  if (s.includes("eth")) return "/tokens/eth.png";
  if (s.includes("sol")) return "/tokens/sol.png";
  if (s.includes("sui")) return "/tokens/sui.png";
  if (s.includes("apt")) return "/tokens/apt.png";
  if (s.includes("trx") || s.includes("jst")) return "/tokens/trx.png";
  if (s.includes("usd") || s.includes("dai")) return "/tokens/usdc.png";
  return "/tokens/eth.png";
}

function fromHuman(s: string, decimals: number): { raw: bigint; n: number } {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return { raw: 0n, n: 0 };
  const [a, b = ""] = String(s).replace(/,/g, "").split(".");
  const frac = `${b}${"0".repeat(decimals)}`.slice(0, decimals);
  try {
    return { raw: BigInt(`${a || "0"}${frac}`), n };
  } catch {
    return { raw: 0n, n };
  }
}

function line(
  protocol: string,
  chainId: number,
  chain: string,
  symbol: string,
  raw: bigint,
  decimals: number,
  side: "supply" | "borrow",
  contract: string,
  quote: Quote | null,
  n?: number,
): ProtocolLine {
  const amt = n != null && Number.isFinite(n) ? n : Number(formatUnits(raw, decimals));
  const value = quote && Number.isFinite(amt) ? amt * quote.usdc : null;
  return {
    id: `${protocol}-${chainId}-${side}-${contract}-${symbol}`,
    chainId,
    chain,
    symbol,
    name: symbol,
    icon: iconOf(symbol),
    amount: Number.isFinite(amt) ? fmtHuman(amt) : fmtAmt(raw, decimals),
    raw,
    contract,
    side,
    quote,
    valueUsdc: side === "borrow" && value != null ? -value : value,
  };
}

function fmtHuman(n: number) {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function card(protocol: string, chainId: number, chain: string, lines: ProtocolLine[], health = "—"): LendCard | null {
  if (!lines.length) return null;
  return { protocol, chainId, chain, health, lines, aTokens: new Set(lines.map((l) => (l.contract ?? "").toLowerCase()).filter(Boolean)) };
}

async function getJson<T>(url: string, ms = 15000): Promise<T | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function suiRpc(method: string, params: unknown[]): Promise<unknown> {
  for (const url of SUI_RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { result?: unknown; error?: unknown };
      if (json.error) continue;
      return json.result;
    } catch {
      /* next */
    }
  }
  return null;
}

function fieldsOf(obj: unknown): Json {
  if (!obj || typeof obj !== "object") return {};
  const o = obj as Json;
  const data = (o.data ?? o) as Json;
  const content = ((data as Json).content ?? data) as Json;
  const fields = ((content as Json).fields ?? content) as Json;
  const value = fields.value as Json | undefined;
  if (value && typeof value === "object" && value.fields && typeof value.fields === "object") return value.fields as Json;
  return fields ?? {};
}

function parseDecimal(x: unknown): number | null {
  if (x == null) return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (typeof x === "string") {
    if (/^\d+$/.test(x) && x.length > 15) return Number(x) / 1e18;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof x === "object") {
    const o = x as Json;
    if (o.fields) return parseDecimal((o.fields as Json).value);
    if ("value" in o) return parseDecimal(o.value);
  }
  return null;
}

function typeName(x: unknown): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object") {
    const o = x as Json;
    if (typeof o.name === "string") return o.name;
    const f = o.fields as Json | undefined;
    if (f && typeof f.name === "string") return f.name;
  }
  return "";
}

function coinSymbol(coinType: string) {
  const last = coinType.split("::").pop() ?? coinType;
  return last.replace(/^COIN$/i, coinType.slice(0, 6));
}

function coinDecimals(coinType: string) {
  const t = coinType.toLowerCase();
  if (t.includes("::sui::sui")) return 9;
  if (t.includes("usdc") || t.includes("usdt") || t.includes("usds") || t.includes("usd1")) return 6;
  if (t.includes("wbtc") || t.includes("btc")) return 8;
  return 9;
}

export async function readKamino(user: string, quotes: Map<string, Quote>): Promise<LendCard | null> {
  if (!user) return null;
  const markets = await getJson<Array<{ lendingMarket?: string; isPrimary?: boolean }>>("https://api.kamino.finance/v2/kamino-market");
  const ids = [...(markets ?? [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).map((m) => m.lendingMarket).filter(Boolean) as string[];
  const lines: ProtocolLine[] = [];
  let health = "—";
  await Promise.all(
    ids.slice(0, 8).map(async (market) => {
      const obs = await getJson<Array<{ obligationAddress?: string }>>(`https://api.kamino.finance/kamino-market/${market}/users/${user}/obligations`);
      for (const ob of (obs ?? []).slice(0, 4)) {
        const pk = ob.obligationAddress;
        if (!pk) continue;
        const loan = await getJson<{
          loanInfo?: {
            currentLtv?: number;
            liquidationLtv?: number;
            collateral?: { deposits?: Array<{ tokenMint?: string; tokenName?: string; tokenAmount?: string; tokenValue?: string; tokenPrice?: number }> };
            debt?: { borrows?: Array<{ tokenMint?: string; tokenName?: string; tokenAmount?: string; tokenValue?: string; tokenPrice?: number }> };
          };
        }>(`https://api.kamino.finance/klend/loans/${pk}`);
        const info = loan?.loanInfo;
        if (!info) continue;
        if (info.currentLtv && info.liquidationLtv) {
          const hf = info.currentLtv > 0 ? info.liquidationLtv / info.currentLtv : 0;
          if (Number.isFinite(hf) && hf > 0) health = hf.toFixed(2);
        }
        const add = async (rows: Array<{ tokenMint?: string; tokenName?: string; tokenAmount?: string; tokenValue?: string; tokenPrice?: number }> | undefined, side: "supply" | "borrow") => {
          for (const r of rows ?? []) {
            const mint = r.tokenMint || "";
            const { raw, n } = fromHuman(r.tokenAmount || "0", mint === SOL_NATIVE || (r.tokenName || "").includes("SOL") ? 9 : 6);
            if (n <= 0) continue;
            const px = Number(r.tokenPrice ?? r.tokenValue) / (n || 1);
            const q: Quote | null =
              quotes.get(`101:${mint === SOL_NATIVE ? "native" : mint.toLowerCase()}`) ??
              (Number.isFinite(Number(r.tokenPrice)) && Number(r.tokenPrice) > 0
                ? { usdc: Number(r.tokenPrice), source: "jup" }
                : Number.isFinite(px) && px > 0
                  ? { usdc: px, source: "jup" }
                  : null);
            const usd = Number(r.tokenValue);
            const lineRow = line("kamino", 101, "SOL", r.tokenName || "TKN", raw, 9, side, mint, q, n);
            if (Number.isFinite(usd) && usd > 0) lineRow.valueUsdc = side === "borrow" ? -usd : usd;
            lines.push(lineRow);
          }
        };
        await add(info.collateral?.deposits, "supply");
        await add(info.debt?.borrows, "borrow");
      }
    }),
  );
  return card("Kamino", 101, "SOL", lines, health);
}

export async function readJupiterLend(user: string, quotes: Map<string, Quote>): Promise<LendCard | null> {
  if (!user) return null;
  const lines: ProtocolLine[] = [];
  const earn = await getJson<
    Array<{
      ownerAddress?: string;
      shares?: string;
      underlyingAssets?: string;
      underlyingBalance?: string;
      token?: { assetAddress?: string; asset?: { address?: string; symbol?: string; decimals?: number; price?: string }; symbol?: string; decimals?: number };
    }>
  >(`https://lite-api.jup.ag/lend/v1/earn/positions?users=${user}`);
  for (const p of earn ?? []) {
    if (p.ownerAddress && p.ownerAddress !== user) continue;
    const raw = BigInt(p.underlyingAssets || "0");
    if (raw === 0n) continue;
    const asset = p.token?.asset;
    const mint = p.token?.assetAddress || asset?.address || "";
    const decimals = asset?.decimals ?? p.token?.decimals ?? 6;
    const symbol = asset?.symbol || p.token?.symbol || "TKN";
    const px = Number(asset?.price ?? 0);
    const q =
      quotes.get(`101:${mint === SOL_NATIVE ? "native" : mint.toLowerCase()}`) ??
      (Number.isFinite(px) && px > 0 ? { usdc: px, source: "jup" as const } : null);
    lines.push(line("jupiter-lend", 101, "SOL", symbol, raw, decimals, "supply", mint, q));
  }
  const borrow = await getJson<
    Array<{
      owner?: string;
      ownerAddress?: string;
      supply?: string;
      borrow?: string;
      dustBorrow?: string;
      supplyToken?: { address?: string; symbol?: string; decimals?: number; price?: string };
      borrowToken?: { address?: string; symbol?: string; decimals?: number; price?: string };
    }>
  >(`https://lite-api.jup.ag/lend/v1/borrow/positions?users=${user}`, 20000);
  for (const p of borrow ?? []) {
    const owner = p.ownerAddress || p.owner;
    if (owner && owner !== user) continue;
    const addSide = (tok: { address?: string; symbol?: string; decimals?: number; price?: string } | undefined, amt: string | undefined, side: "supply" | "borrow") => {
      const n = Number(amt);
      if (!Number.isFinite(n) || n <= 0) return;
      const decimals = tok?.decimals ?? 9;
      const { raw } = fromHuman(String(n), decimals);
      const mint = tok?.address || "";
      const px = Number(tok?.price);
      const q =
        quotes.get(`101:${mint === SOL_NATIVE ? "native" : mint.toLowerCase()}`) ??
        (Number.isFinite(px) && px > 0 ? { usdc: px, source: "jup" as const } : null);
      lines.push(line("jupiter-lend", 101, "SOL", tok?.symbol || "TKN", raw || BigInt(Math.round(n * 10 ** Math.min(decimals, 9))), decimals, side, mint, q, n));
    };
    addSide(p.supplyToken, p.supply, "supply");
    addSide(p.borrowToken, p.borrow || p.dustBorrow, "borrow");
  }
  return card("Jupiter Lend", 101, "SOL", lines);
}

type NaviPool = {
  id?: number;
  coinType?: string;
  token?: { symbol?: string; decimals?: number; price?: number };
  oracle?: { price?: string; decimal?: number };
};

export async function readNavi(user: string): Promise<LendCard | null> {
  if (!user) return null;
  const info = await suiRpc("suix_getDynamicFieldObject", [NAVI_STORAGE_USERS, { type: "address", value: user }]);
  if (!info) return null;
  const uf = fieldsOf(info);
  const collaterals = ((uf.collaterals as unknown[]) ?? []).map(Number);
  const loans = ((uf.loans as unknown[]) ?? []).map(Number);
  const ids = [...new Set([...collaterals, ...loans])].filter((n) => Number.isFinite(n));
  if (!ids.length) return null;
  const pools = (await getJson<{ data?: NaviPool[] }>("https://open-api.naviprotocol.io/api/navi/pools"))?.data ?? [];
  const byId = new Map(pools.map((p) => [Number(p.id), p]));
  const lines: ProtocolLine[] = [];
  await Promise.all(
    ids.map(async (id) => {
      try {
        const reserve = await suiRpc("suix_getDynamicFieldObject", [NAVI_RESERVES, { type: "u8", value: id }]);
        const rf = fieldsOf(reserve);
        const coinType = String(rf.coin_type || byId.get(id)?.coinType || "");
        const supplyIdx = BigInt(String(rf.current_supply_index || "0"));
        const borrowIdx = BigInt(String(rf.current_borrow_index || "0"));
        const supplyTable = ((rf.supply_balance as Json)?.fields as Json | undefined)?.user_state as Json | undefined;
        const borrowTable = ((rf.borrow_balance as Json)?.fields as Json | undefined)?.user_state as Json | undefined;
        const supplyTid = ((supplyTable?.fields as Json | undefined)?.id as Json | undefined)?.id as string | undefined;
        const borrowTid = ((borrowTable?.fields as Json | undefined)?.id as Json | undefined)?.id as string | undefined;
        const scaledOf = async (table: string | undefined) => {
          if (!table) return 0n;
          const row = await suiRpc("suix_getDynamicFieldObject", [table, { type: "address", value: user }]);
          if (!row) return 0n;
          const f = fieldsOf(row);
          const v = f.value ?? f;
          try {
            return BigInt(String(v ?? "0"));
          } catch {
            return 0n;
          }
        };
        const sScaled = collaterals.includes(id) ? await scaledOf(supplyTid) : 0n;
        const bScaled = loans.includes(id) ? await scaledOf(borrowTid) : 0n;
        const supply = supplyIdx && sScaled ? (sScaled * supplyIdx) / RAY : 0n;
        const borrow = borrowIdx && bScaled ? (bScaled * borrowIdx) / RAY : 0n;
        const pool = byId.get(id);
        const decimals = pool?.token?.decimals ?? pool?.oracle?.decimal ?? coinDecimals(coinType);
        const symbol = pool?.token?.symbol || coinSymbol(coinType) || `A${id}`;
        const px = Number(pool?.oracle?.price ?? pool?.token?.price);
        const q: Quote | null = Number.isFinite(px) && px > 0 ? { usdc: px, source: "agg" } : null;
        const mint = coinType.startsWith("0x") ? coinType : `0x${coinType}`;
        if (supply > 0n) lines.push(line("navi", 784, "SUI", symbol, supply, decimals, "supply", mint, q));
        if (borrow > 0n) lines.push(line("navi", 784, "SUI", symbol, borrow, decimals, "borrow", mint, q));
      } catch {
        /* reserve miss */
      }
    }),
  );
  return card("NAVI", 784, "SUI", lines);
}

export async function readSuilend(user: string): Promise<LendCard | null> {
  if (!user) return null;
  const caps: string[] = [];
  for (const typ of SUILEND_CAPS) {
    let cursor: string | null = null;
    for (let i = 0; i < 4; i++) {
      const page = (await suiRpc("suix_getOwnedObjects", [
        user,
        { filter: { StructType: typ }, options: { showContent: true, showType: true }, cursor, limit: 50 },
      ])) as { data?: Array<{ data?: Json }>; nextCursor?: string | null; hasNextPage?: boolean } | null;
      for (const row of page?.data ?? []) {
        const f = fieldsOf(row.data ?? row);
        const oid = String(f.obligation_id ?? f.obligationId ?? "");
        if (oid && oid !== "0x0") caps.push(oid);
      }
      if (!page?.hasNextPage) break;
      cursor = page.nextCursor ?? null;
      if (!cursor) break;
    }
  }
  const lines: ProtocolLine[] = [];
  let health = "—";
  await Promise.all(
    [...new Set(caps)].slice(0, 8).map(async (oid) => {
      const obj = await suiRpc("sui_getObject", [oid, { showContent: true }]);
      const f = fieldsOf(obj);
      const deposits = (f.deposits as Array<{ fields?: Json; type?: string }> | undefined) ?? [];
      const borrows = (f.borrows as Array<{ fields?: Json; type?: string }> | undefined) ?? [];
      const depUsd = parseDecimal(f.deposited_value_usd);
      const borUsd = parseDecimal(f.weighted_borrowed_value_usd) ?? parseDecimal(f.unweighted_borrowed_value_usd);
      const unhealthy = parseDecimal(f.unhealthy_borrow_value_usd);
      if (borUsd && unhealthy && borUsd > 0) health = (unhealthy / borUsd).toFixed(2);
      else if (depUsd && borUsd && borUsd > 0) health = (depUsd / borUsd).toFixed(2);
      const add = (rows: Array<{ fields?: Json }>, side: "supply" | "borrow") => {
        for (const r of rows) {
          const rf = r.fields ?? (r as Json);
          const coin = typeName(rf.coin_type);
          const symbol = coinSymbol(coin) || "TKN";
          const usd = parseDecimal(rf.market_value);
          const ctoken = BigInt(String(rf.deposited_ctoken_amount ?? "0"));
          const borrowed = parseDecimal(rf.borrowed_amount);
          const decimals = coinDecimals(coin);
          let n = 0;
          let raw = 0n;
          if (side === "supply") {
            raw = ctoken;
            n = Number(formatUnits(ctoken, decimals));
          } else {
            n = borrowed ?? 0;
            raw = fromHuman(String(n), decimals).raw;
          }
          if ((n <= 0 && raw === 0n) || (usd != null && usd <= 0 && raw === 0n && n <= 0)) continue;
          const q: Quote | null = usd != null && n > 0 ? { usdc: usd / n, source: "agg" } : usd != null && usd > 0 ? { usdc: 1, source: "agg" } : null;
          const row = line("suilend", 784, "SUI", symbol, raw || 1n, decimals, side, coin, q, n || usd || 0);
          if (usd != null && usd > 0) row.valueUsdc = side === "borrow" ? -usd : usd;
          if (n > 0) row.amount = fmtHuman(n);
          lines.push(row);
        }
      };
      add(deposits, "supply");
      add(borrows, "borrow");
    }),
  );
  return card("Suilend", 784, "SUI", lines, health);
}

export async function readJustLend(user: string): Promise<LendCard | null> {
  if (!user) return null;
  const [acct, markets, v2] = await Promise.all([
    getJson<{
      code?: number;
      data?: { list?: Array<{ health?: string; tokens?: Array<{ address?: string; underlyingSymbol?: string; supplyBalanceUnderlying?: string; borrowBalanceUnderlying?: string }> }> };
    }>(`https://openapi.just.network/lend/account?addresses=${user}`),
    getJson<{ data?: { tokenList?: Array<{ address?: string; underlyingSymbol?: string; underlyingDecimal?: number; underlyingPriceInTrx?: string }> } }>(
      "https://openapi.just.network/lend/jtoken",
    ),
    getJson<{
      code?: number;
      data?: {
        totalSupplyUsd?: string;
        totalBorrowUsd?: string;
        totalCollateralUsd?: string;
        vaults?: Array<{ vaultAddress?: string; supplyUsd?: string }>;
        markets?: Array<{ marketId?: string; collateralUsd?: string; borrowUsd?: string }>;
      };
    }>(`https://openapi.just.network/v2/index/position?address=${user}`),
  ]);
  const lines: ProtocolLine[] = [];
  const meta = new Map((markets?.data?.tokenList ?? []).map((t) => [t.address, t]));
  const usdt = (markets?.data?.tokenList ?? []).find((t) => t.underlyingSymbol === "USDT");
  const trxPerUsdt = Number(usdt?.underlyingPriceInTrx);
  const trxUsd = Number.isFinite(trxPerUsdt) && trxPerUsdt > 0 ? 1 / trxPerUsdt : null;
  const row = acct?.data?.list?.[0];
  const health = row?.health && Number(row.health) > 0 ? Number(row.health).toFixed(2) : "—";
  for (const t of row?.tokens ?? []) {
    const sup = Number(t.supplyBalanceUnderlying || "0");
    const bor = Number(t.borrowBalanceUnderlying || "0");
    if (sup <= 0 && bor <= 0) continue;
    const m = meta.get(t.address);
    const decimals = m?.underlyingDecimal ?? 6;
    const symbol = t.underlyingSymbol || "TKN";
    const pxTrx = Number(m?.underlyingPriceInTrx);
    const usd = trxUsd && Number.isFinite(pxTrx) ? pxTrx * trxUsd : symbol.includes("USD") ? 1 : null;
    const q: Quote | null = usd && usd > 0 ? { usdc: usd, source: "agg" } : null;
    if (sup > 0) {
      const { raw } = fromHuman(String(sup), decimals);
      lines.push(line("justlend", 728126428, "TRX", symbol, raw, decimals, "supply", t.address || symbol, q, sup));
    }
    if (bor > 0) {
      const { raw } = fromHuman(String(bor), decimals);
      lines.push(line("justlend", 728126428, "TRX", symbol, raw, decimals, "borrow", t.address || symbol, q, bor));
    }
  }
  const usdQ: Quote = { usdc: 1, source: "agg" };
  for (const vault of v2?.data?.vaults ?? []) {
    const n = Number(vault.supplyUsd || "0");
    if (n <= 0) continue;
    lines.push(line("justlend", 728126428, "TRX", "V2 vault", fromHuman(String(n), 6).raw, 6, "supply", vault.vaultAddress || "v2", usdQ, n));
  }
  for (const mkt of v2?.data?.markets ?? []) {
    const col = Number(mkt.collateralUsd || "0");
    const bor = Number(mkt.borrowUsd || "0");
    if (col > 0) lines.push(line("justlend", 728126428, "TRX", "V2 collateral", fromHuman(String(col), 6).raw, 6, "supply", mkt.marketId || "v2", usdQ, col));
    if (bor > 0) lines.push(line("justlend", 728126428, "TRX", "V2 borrow", fromHuman(String(bor), 6).raw, 6, "borrow", mkt.marketId || "v2", usdQ, bor));
  }
  return card("JustLend", 728126428, "TRX", lines, health);
}

const SCALLOP_CORE = "0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf";
const SCALLOP_KEY = `${SCALLOP_CORE}::obligation::ObligationKey`;
const ECHELON = "0xc6bc659f1649553c1a3fa05d9727433dc03843baac29473c817d06d39e7621ba";
const APTOS_RPCS = ["https://fullnode.mainnet.aptoslabs.com/v1", "https://api.mainnet.aptoslabs.com/v1"];

function normType(t: string) {
  return (t.startsWith("0x") ? t : `0x${t}`).toLowerCase();
}

function tableIdOf(x: unknown): string | null {
  if (!x || typeof x !== "object") return null;
  const f = (x as Json).fields as Json | undefined;
  const id = f?.id ?? (x as Json).id;
  if (typeof id === "string" && id.startsWith("0x")) return id;
  if (id && typeof id === "object") {
    const inner = (id as Json).id ?? (id as Json).inner;
    if (typeof inner === "string" && inner.startsWith("0x")) return inner;
  }
  return null;
}

function fp64(v: unknown): number {
  const s = typeof v === "object" && v && "v" in (v as Json) ? String((v as Json).v) : String(v ?? "");
  if (!/^\d+$/.test(s)) return 0;
  try {
    return Number(BigInt(s)) / 2 ** 64;
  } catch {
    return 0;
  }
}

function mantissaDecimals(raw: string): number {
  try {
    let x = BigInt(raw || "1");
    if (x <= 0n) return 8;
    let d = 0;
    while (x >= 10n && x % 10n === 0n && d < 18) {
      x /= 10n;
      d++;
    }
    return d || 8;
  } catch {
    return 8;
  }
}

async function aptosView(fn: string, args: unknown[], types: string[] = []): Promise<unknown> {
  const body = JSON.stringify({ function: fn, type_arguments: types, arguments: args });
  for (const base of APTOS_RPCS) {
    try {
      const res = await fetch(`${base}/view`, { method: "POST", headers: { "content-type": "application/json" }, body });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      /* next */
    }
  }
  return null;
}

type ScallopPool = {
  symbol?: string;
  coinType?: string;
  sCoinType?: string;
  coinDecimal?: number;
  coinPrice?: number;
  conversionRate?: number;
  borrowIndex?: number;
};

export async function readScallop(user: string): Promise<LendCard | null> {
  if (!user) return null;
  const market = await getJson<{ pools?: ScallopPool[]; collaterals?: ScallopPool[] }>("https://sdk.api.scallop.io/api/market");
  const pools = [...(market?.pools ?? []), ...(market?.collaterals ?? [])];
  const byCoin = new Map<string, ScallopPool>();
  const bySCoin = new Map<string, ScallopPool>();
  for (const p of pools) {
    if (p.coinType) byCoin.set(normType(p.coinType), p);
    if (p.sCoinType) bySCoin.set(normType(p.sCoinType), p);
  }
  const lines: ProtocolLine[] = [];
  const bals = (await suiRpc("suix_getAllBalances", [user])) as Array<{ coinType?: string; totalBalance?: string }> | null;
  for (const b of bals ?? []) {
    const coin = normType(b.coinType || "");
    const pool = bySCoin.get(coin);
    if (!pool) continue;
    const raw = BigInt(b.totalBalance || "0");
    if (raw === 0n) continue;
    const decimals = pool.coinDecimal ?? coinDecimals(pool.coinType || "");
    const n = Number(formatUnits(raw, decimals)) * (Number(pool.conversionRate) || 1);
    if (n <= 0) continue;
    const q: Quote | null = Number(pool.coinPrice) > 0 ? { usdc: Number(pool.coinPrice), source: "agg" } : null;
    const { raw: adj } = fromHuman(String(n), decimals);
    lines.push(line("scallop", 784, "SUI", pool.symbol || coinSymbol(pool.coinType || ""), adj || raw, decimals, "supply", pool.coinType || coin, q, n));
  }
  const keys: string[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 4; i++) {
    const page = (await suiRpc("suix_getOwnedObjects", [
      user,
      { filter: { StructType: SCALLOP_KEY }, options: { showContent: true, showType: true }, cursor, limit: 50 },
    ])) as { data?: Array<{ data?: Json }>; nextCursor?: string | null; hasNextPage?: boolean } | null;
    for (const row of page?.data ?? []) {
      const f = fieldsOf(row.data ?? row);
      const oid = String(f.obligation_id ?? f.obligationId ?? f.ownership ?? "");
      if (oid && oid !== "0x0") keys.push(oid.startsWith("0x") ? oid : `0x${oid}`);
    }
    if (!page?.hasNextPage) break;
    cursor = page.nextCursor ?? null;
    if (!cursor) break;
  }
  const addTable = async (tid: string | null, side: "supply" | "borrow") => {
    if (!tid) return;
    const page = (await suiRpc("suix_getDynamicFields", [{ parentId: tid, cursor: null, limit: 50 }])) as {
      data?: Array<{ objectId?: string; name?: { type?: string; value?: unknown } }>;
    } | null;
    await Promise.all(
      (page?.data ?? []).slice(0, 24).map(async (df) => {
        const obj = await suiRpc("sui_getObject", [df.objectId, { showContent: true }]);
        const f = fieldsOf(obj);
        const nameVal = df.name?.value;
        const coin =
          typeof nameVal === "string"
            ? nameVal
            : typeName(nameVal) || typeName(f.name) || String((f as Json).name ?? "");
        const amount = BigInt(String(f.amount ?? f.value ?? "0"));
        if (amount === 0n) return;
        const idx = Number(f.borrow_index ?? f.borrowIndex ?? 0);
        const pool = byCoin.get(normType(coin));
        const decimals = pool?.coinDecimal ?? coinDecimals(coin);
        let n = Number(formatUnits(amount, decimals));
        if (side === "borrow" && idx > 0 && pool?.borrowIndex) n = n * (Number(pool.borrowIndex) / idx);
        if (!Number.isFinite(n) || n <= 0) return;
        const q: Quote | null = Number(pool?.coinPrice) > 0 ? { usdc: Number(pool?.coinPrice), source: "agg" } : null;
        const { raw } = fromHuman(String(n), decimals);
        lines.push(line("scallop", 784, "SUI", pool?.symbol || coinSymbol(coin), raw || amount, decimals, side, coin, q, n));
      }),
    );
  };
  await Promise.all(
    [...new Set(keys)].slice(0, 8).map(async (oid) => {
      const obj = await suiRpc("sui_getObject", [oid, { showContent: true }]);
      const f = fieldsOf(obj);
      await addTable(tableIdOf(f.collaterals), "supply");
      await addTable(tableIdOf(f.debts), "borrow");
    }),
  );
  return card("Scallop", 784, "SUI", lines);
}

export async function readEchelon(user: string): Promise<LendCard | null> {
  if (!user) return null;
  const marketsRaw = await aptosView(`${ECHELON}::lending::market_objects`, []);
  const markets = (Array.isArray(marketsRaw) ? marketsRaw[0] : marketsRaw) as Array<{ inner?: string } | string> | null;
  const ids = (markets ?? [])
    .map((m) => (typeof m === "string" ? m : m?.inner))
    .filter((x): x is string => Boolean(x))
    .slice(0, 40);
  if (!ids.length) return null;
  const lines: ProtocolLine[] = [];
  await Promise.all(
    ids.map(async (market) => {
      try {
        const [coins, debt, name, mantissa, price] = await Promise.all([
          aptosView(`${ECHELON}::lending::account_coins`, [user, market]),
          aptosView(`${ECHELON}::lending::account_liability`, [user, market]),
          aptosView(`${ECHELON}::lending::market_asset_name`, [market]),
          aptosView(`${ECHELON}::lending::market_asset_mantissa`, [market]),
          aptosView(`${ECHELON}::lending::asset_price`, [market]),
        ]);
        const supply = BigInt(String(Array.isArray(coins) ? coins[0] : coins ?? "0"));
        const borrow = BigInt(String(Array.isArray(debt) ? debt[0] : debt ?? "0"));
        if (supply === 0n && borrow === 0n) return;
        const decimals = mantissaDecimals(String(Array.isArray(mantissa) ? mantissa[0] : mantissa ?? "100000000"));
        const symbol = String(Array.isArray(name) ? name[0] : name || "TKN").replace(/ Coin$/i, "") || "TKN";
        const px = fp64(Array.isArray(price) ? price[0] : price);
        const q: Quote | null = px > 0 && px < 1e7 ? { usdc: px, source: "agg" } : null;
        if (supply > 0n) lines.push(line("echelon", 637, "APT", symbol, supply, decimals, "supply", market, q));
        if (borrow > 0n) lines.push(line("echelon", 637, "APT", symbol, borrow, decimals, "borrow", market, q));
      } catch {
        /* market miss */
      }
    }),
  );
  let health = "—";
  try {
    const lend = fp64(((await aptosView(`${ECHELON}::lending::account_lend_value`, [user])) as unknown[])?.[0]);
    const liab = fp64(((await aptosView(`${ECHELON}::lending::account_liability_value`, [user])) as unknown[])?.[0]);
    if (liab > 0 && lend > 0) health = (lend / liab).toFixed(2);
  } catch {
    /* no hf */
  }
  return card("Echelon", 637, "APT", lines, health);
}

export async function readNativeLending(opts: {
  sol?: string;
  sui?: string;
  tron?: string;
  aptos?: string;
  quotes: Map<string, Quote>;
}): Promise<LendCard[]> {
  const jobs: Array<Promise<LendCard | null>> = [];
  if (opts.sol) {
    jobs.push(readKamino(opts.sol, opts.quotes));
    jobs.push(readJupiterLend(opts.sol, opts.quotes));
  }
  if (opts.sui) {
    jobs.push(readNavi(opts.sui));
    jobs.push(readSuilend(opts.sui));
    jobs.push(readScallop(opts.sui));
  }
  if (opts.tron) jobs.push(readJustLend(opts.tron));
  if (opts.aptos) jobs.push(readEchelon(opts.aptos));
  const rows = await Promise.all(jobs);
  return rows.filter((c): c is LendCard => Boolean(c));
}
