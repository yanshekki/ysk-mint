/** Name fragments that are not US-listed / US-company equity wrappers. */
const NON_US_EQUITY = /rootstock|metadao|bending spoons|sk hynix/i;

const EQUITY_NAME =
  /xstock|tokenized stock|tokenized etf|bstocks|pre-ipo stock/i;

/** Backed bTokens for US stocks/ETFs. Bonds and T-bills stay off this desk. */
const BACKED_EQUITY_SYM = /^(btsla|baapl|bnvda|bgoogl|bcoin|bcspx|bmsft|bmstr|bgme)$/i;
const BACKED_DEBT = /bond|treasury|govies|t-bill|ultrashort|\berna\b|\bernx\b|\bib01\b|\bibta\b|\bzpr1\b|\bcsbgc/i;
/** Coinbase B20 on Base. Not cbBTC. */
const COINBASE_B20 = /^(aaplc|amznc|coinc|crclc|googlc|intcc|metac|msftc|mstrc|nvdac|sndkc|spcxc|tslac)$/i;

function blobOf(symbol: string, name?: string) {
  return `${symbol} ${name ?? ""}`.replace(/\s+/g, " ").trim();
}

export function nameLooksLikeUsEquity(symbol: string, name?: string) {
  const blob = blobOf(symbol, name);
  if (!blob) return false;
  if (NON_US_EQUITY.test(blob)) return false;
  if (EQUITY_NAME.test(blob)) return true;
  if (BACKED_EQUITY_SYM.test(symbol.replace(/\s+/g, ""))) return true;
  if (COINBASE_B20.test(symbol.replace(/\s+/g, ""))) return true;
  if (/coinbase tokenized/i.test(blob)) return true;
  if (/^backed\b/i.test(name ?? "") && !BACKED_DEBT.test(blob)) return true;
  return false;
}

function normSym(symbol: string) {
  return symbol.replace(/\s+/g, "").toUpperCase();
}

function addrKey(chainId: number, address: string) {
  const a = address.trim();
  if (!a) return "";
  if (a.startsWith("0x") || a.startsWith("0X")) return `${chainId}:${a.toLowerCase()}`;
  return `${chainId}:${a}`;
}

export type EquityCatalogToken = {
  symbol: string;
  name: string;
  chainId: number;
  address?: string;
};

export type EquityLookup = {
  chainIds: Set<number>;
  isToken: (symbol: string, name?: string, chainId?: number, address?: string) => boolean;
  isPair: (row: { chainId: number; tokenA: string; tokenB: string; symbolA: string; symbolB: string }) => boolean;
};

export function makeEquityLookup(tokens: EquityCatalogToken[]): EquityLookup {
  const symbols = new Set<string>();
  const addresses = new Set<string>();
  const chainIds = new Set<number>();
  for (const t of tokens) {
    if (!nameLooksLikeUsEquity(t.symbol, t.name)) continue;
    chainIds.add(t.chainId);
    const sym = normSym(t.symbol);
    if (sym) symbols.add(sym);
    if (t.address) {
      const k = addrKey(t.chainId, t.address);
      if (k) addresses.add(k);
    }
  }

  function isToken(symbol: string, name?: string, chainId?: number, address?: string) {
    if (chainId != null && address) {
      const k = addrKey(chainId, address);
      if (k && addresses.has(k)) return true;
    }
    if (symbol && symbols.has(normSym(symbol))) return true;
    if (name) return nameLooksLikeUsEquity(symbol, name);
    return false;
  }

  function isPair(row: { chainId: number; tokenA: string; tokenB: string; symbolA: string; symbolB: string }) {
    return isToken(row.symbolA, undefined, row.chainId, row.tokenA) || isToken(row.symbolB, undefined, row.chainId, row.tokenB);
  }

  return { chainIds, isToken, isPair };
}
