import { featuredChains } from "@ysk-mint/config";
import { ensureProtocols } from "./defi/protocols.ts";
import { protocolsOn } from "./defi/registry.ts";
import { TOKEN_CATALOG } from "./tokenRegistry.ts";
import { makeEquityLookup } from "./tokenizedEquity.ts";
import { scansMarketChain } from "./useDexMarkets.ts";

const lookup = makeEquityLookup(TOKEN_CATALOG);

export const isTokenizedUsEquityToken = lookup.isToken;
export const isTokenizedUsEquityPair = lookup.isPair;
export const usEquityChainIds = lookup.chainIds;

/** Featured chains that both hold catalogued US equity and have a DEX market scan. */
export function usEquityMarketChains(disabled: number[]) {
  ensureProtocols();
  const off = new Set(disabled);
  return featuredChains().filter(
    (c) =>
      !c.testnet &&
      !off.has(c.chainId) &&
      usEquityChainIds.has(c.chainId) &&
      scansMarketChain(c.chainId) &&
      protocolsOn(c.chainId).length > 0,
  );
}
