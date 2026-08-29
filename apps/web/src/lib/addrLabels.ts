import cex from "./labels/cex.json";
import { DEX, LST } from "./defiAddresses.ts";
import { TOKEN_CATALOG } from "./tokenRegistry.ts";
import { isZeroAddr, protocolName, type AddrTag, type TxRow } from "./txIndex.ts";
import i18n from "./i18n.ts";

const CEX = new Map<string, string>();
for (const row of cex as Array<{ chainId: number; address: string; name: string }>) {
  CEX.set(`${row.chainId}:${row.address.toLowerCase()}`, row.name);
}

const TOKENS = new Set<string>();
for (const t of TOKEN_CATALOG) {
  if (t.native) TOKENS.add(`${t.chainId}:native`);
  if (t.address) TOKENS.add(`${t.chainId}:${t.address.toLowerCase()}`);
}
for (const [chainId, bag] of Object.entries(LST)) {
  for (const addr of Object.keys(bag)) TOKENS.add(`${Number(chainId)}:${addr.toLowerCase()}`);
}
for (const d of Object.values(DEX)) {
  TOKENS.add(`${d.chainId}:${d.wrapped.toLowerCase()}`);
  TOKENS.add(`${d.chainId}:${d.usdc.toLowerCase()}`);
  if (d.usdt) TOKENS.add(`${d.chainId}:${d.usdt.toLowerCase()}`);
  if (d.dai) TOKENS.add(`${d.chainId}:${d.dai.toLowerCase()}`);
}

function key(chainId: number, addr: string) {
  return `${chainId}:${addr.toLowerCase()}`;
}

export function cexName(chainId: number, addr?: string) {
  if (!addr || isZeroAddr(addr)) return undefined;
  return CEX.get(key(chainId, addr));
}

export function tokenKnown(chainId: number, addr?: string) {
  if (!addr) return TOKENS.has(`${chainId}:native`);
  return TOKENS.has(key(chainId, addr));
}

export function tagCounterparty(chainId: number, addr: string | undefined, ours: string): AddrTag | undefined {
  if (!addr) return undefined;
  if (isZeroAddr(addr)) return undefined;
  if (addr.toLowerCase() === ours.toLowerCase()) return undefined;
  const cexHit = cexName(chainId, addr);
  if (cexHit) return { kind: "cex", name: cexHit };
  const proto = protocolName(chainId, addr);
  if (proto) return { kind: "dex", name: proto };
  return { kind: "outside", name: i18n.t("me.txOutside") };
}

export function tagToken(chainId: number, token: string | undefined, mint: boolean): AddrTag {
  if (!token) return { kind: "token", name: "native" };
  if (tokenKnown(chainId, token)) return { kind: "token", name: "catalog" };
  if (mint) return { kind: "airdrop", name: i18n.t("me.txAirdrop") };
  return { kind: "outside", name: i18n.t("me.txOutside") };
}

export function applyTags(row: TxRow): TxRow {
  row.fromTag = tagCounterparty(row.chainId, row.from, row.ours);
  row.toTag = tagCounterparty(row.chainId, row.to, row.ours);
  row.peerTag = tagCounterparty(row.chainId, row.peer, row.ours);
  const mint = isZeroAddr(row.from) || row.method === "mint";
  for (const f of row.flows) f.tag = tagToken(row.chainId, f.token, mint && f.dir === "in");
  const named = row.toTag?.kind === "cex" || row.toTag?.kind === "dex" ? row.toTag : row.peerTag?.kind === "cex" || row.peerTag?.kind === "dex" ? row.peerTag : undefined;
  if (named && !row.protocol) {
    row.protocol = named.name;
    row.peerLabel = named.name;
  }
  const tokenFlows = row.flows.filter((f) => f.token);
  row.spam = tokenFlows.length
    ? tokenFlows.every((f) => f.tag?.kind === "outside" || f.tag?.kind === "airdrop")
    : mint && row.kind === "in";
  return row;
}

export function isSpamRow(row: TxRow) {
  return Boolean(row.spam);
}
