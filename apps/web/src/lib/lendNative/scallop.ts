import { formatUnits } from "viem";
import type { Quote } from "../defiQuotes.ts";
import type { LendCard } from "../lendingExtra.ts";
import type { ProtocolLine } from "../defiPositions.ts";
import { card, coinDecimals, coinSymbol, fieldsOf, fromHuman, getJson, line, suiRpc, typeName, type Json } from "./shared.ts";

const SCALLOP_CORE = "0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf";
const SCALLOP_KEY = `${SCALLOP_CORE}::obligation::ObligationKey`;
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
