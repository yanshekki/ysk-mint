import type { PublicClient } from "viem";

export type DefiCap = "markets" | "quote" | "lp" | "positions";

export type TokenRef = {
  chainId: number;
  address: string;
  decimals: number;
  symbol?: string;
  native?: boolean;
};

export type PoolRef = {
  protocolId: string;
  chainId: number;
  pool: string;
  tokenA: string;
  tokenB: string;
  feeLabel: string;
  extra?: Record<string, string | number | boolean>;
};

export type VenueQuote = {
  protocolId: string;
  protocolName: string;
  chainId: number;
  pool: string;
  feeLabel: string;
  priceAinB: number;
  reserveA: number;
  reserveB: number;
  tvlQuote: number;
  kind: "v2" | "v3" | "aero" | "ref" | "minswap" | "jup";
};

export type QuoteSource = "v3" | "v2" | "jup" | "stable" | "ref" | "minswap" | "agg";

export type Quote = {
  usdc: number;
  source: QuoteSource;
  depth?: number;
};

export type DefiCtx = {
  evm?: PublicClient;
};

export type MarketRow = {
  pairId: string;
  chainId: number;
  chainShort: string;
  symbolA: string;
  symbolB: string;
  iconA: string;
  iconB: string;
  tokenA: string;
  tokenB: string;
  venues: VenueQuote[];
  price: number | null;
  depth: number;
  venueNames: string[];
};

export type DefiProtocol = {
  id: string;
  name: string;
  chainId: number;
  caps: DefiCap[];
  discover?(ctx: DefiCtx, tokenA: TokenRef, tokenB: TokenRef): Promise<PoolRef[]>;
  discoverMany?(
    ctx: DefiCtx,
    pairs: Array<{ a: TokenRef; b: TokenRef }>,
  ): Promise<Array<{ a: TokenRef; b: TokenRef; refs: PoolRef[] }>>;
  readPool?(ctx: DefiCtx, ref: PoolRef, tokenA: TokenRef, tokenB: TokenRef): Promise<VenueQuote | null>;
  quoteUsd?(ctx: DefiCtx, token: TokenRef): Promise<Quote | null>;
  markets?(ctx: DefiCtx): Promise<MarketRow[]>;
};
