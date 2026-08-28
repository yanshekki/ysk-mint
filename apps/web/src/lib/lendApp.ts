import { CHAINS } from "@ysk-mint/config";

const AAVE: Record<number, string> = {
  1: "ethereum",
  10: "optimism",
  56: "bnb",
  137: "polygon",
  8453: "base",
  42161: "arbitrum",
  43114: "avalanche",
  59144: "linea",
  534352: "scroll",
  324: "zksync",
  100: "gnosis",
};

export function lendExplorerHref(chainId: number, address?: string): string | undefined {
  const chain = Object.values(CHAINS).find((c) => c.chainId === chainId);
  if (!chain) return undefined;
  const base = chain.explorer.split("?")[0].replace(/\/$/, "");
  if (!address || address === "native") return chain.explorer;
  if (chain.vm === "solana") {
    const q = chain.explorer.includes("cluster=") ? `?${chain.explorer.split("?")[1]}` : "";
    return `${base}/token/${address}${q}`;
  }
  if (chain.vm === "near") return `${base}/token/${address}`;
  if (chain.vm === "tron") return `${base}/#/contract/${address}`;
  if (chain.vm === "sui") return `${base}/mainnet/object/${address}`;
  if (chain.vm === "aptos") return `${base}/account/${address}`;
  return `${base}/address/${address}`;
}

export function lendAppHref(protocol: string, chainId: number, token?: string): string | undefined {
  const p = protocol.toLowerCase();
  const aave = AAVE[chainId];
  if (p === "aave" && aave) {
    return token && token !== "native"
      ? `https://app.aave.com/reserve-overview/?underlyingAsset=${token.toLowerCase()}&marketName=proto_${aave}_v3`
      : "https://app.aave.com/";
  }
  if (p === "spark") return "https://app.spark.fi/";
  if (p === "compound" || p === "compound iii") return "https://app.compound.finance/";
  if (p === "venus") return "https://app.venus.io/";
  if (p === "moonwell") return chainId === 8453 ? "https://moonwell.fi/markets/supply/base" : "https://moonwell.fi/";
  if (p === "benqi") return "https://app.benqi.fi/markets";
  if (p === "hyperlend") return "https://app.hyperlend.finance/";
  if (p === "zerolend") return "https://app.zerolend.xyz/";
  if (p === "morpho") return "https://app.morpho.org/";
  if (p === "euler") return "https://app.euler.finance/";
  if (p === "fluid") return "https://fluid.io/";
  if (p === "silo") return "https://www.silo.finance/";
  if (p === "fraxlend") return "https://app.frax.finance/fraxlend";
  if (p === "seamless") return "https://app.seamlessprotocol.com/";
  if (p === "dolomite") return "https://app.dolomite.io/";
  if (p === "lista") return "https://lista.org/";
  if (p === "kamino") return "https://app.kamino.finance/lending";
  if (p === "jupiter lend") return "https://jup.ag/lend";
  if (p === "navi") return "https://app.naviprotocol.io/";
  if (p === "suilend") return "https://suilend.fi/";
  if (p === "justlend") return "https://justlend.just.network/";
  if (p === "scallop") return "https://app.scallop.io/";
  if (p === "echelon") return "https://app.echelon.market/";
  if (p === "burrow") return "https://app.burrow.finance/";
  return undefined;
}
