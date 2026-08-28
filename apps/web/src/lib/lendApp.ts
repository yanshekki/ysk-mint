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

export function stakeBrandName(opts: { symbol?: string; extra?: string; name?: string; chainId?: number; contract?: string }): string {
  const hay = `${opts.symbol ?? ""} ${opts.extra ?? ""} ${opts.name ?? ""} ${opts.contract ?? ""}`.toLowerCase();
  if (hay.includes("steth") || hay.includes("wsteth") || hay.includes("lido")) return "Lido";
  if (hay.includes("reth") || hay.includes("rocket")) return "Rocket Pool";
  if (hay.includes("cbeth")) return "Coinbase";
  if (hay.includes("weeth") || hay.includes("ether.fi")) return "ether.fi";
  if (hay.includes("savax") || (hay.includes("benqi") && (opts.chainId ?? 0) === 43114)) return "BENQI";
  if (hay.includes("linear") || hay.includes("linear-protocol") || (opts.chainId === 397 && /\blst\b/i.test(opts.symbol ?? ""))) return "LiNEAR";
  if (hay.includes("stnear") || hay.includes("meta-pool") || hay.includes("meta pool")) return "Meta Pool";
  if (hay.includes("msol") || hay.includes("marinade")) return "Marinade";
  if (hay.includes("jitosol") || hay.includes("jito")) return "Jito";
  if (hay.includes("bsol") || hay.includes("blaze")) return "Blaze";
  if (opts.chainId === 397) return "NEAR";
  if (opts.chainId === 1815) return "Cardano";
  if (opts.chainId === 101) return "Solana";
  return opts.extra?.split(" ")[0] || opts.name || "Stake";
}

export function stakeAppHref(opts: { symbol?: string; extra?: string; name?: string; chainId?: number; contract?: string }): string | undefined {
  const hay = `${opts.symbol ?? ""} ${opts.extra ?? ""} ${opts.name ?? ""} ${opts.contract ?? ""}`.toLowerCase();
  if (hay.includes("steth") || hay.includes("wsteth") || hay.includes("lido")) return "https://stake.lido.fi/";
  if (hay.includes("reth") || hay.includes("rocket")) return "https://stake.rocketpool.net/";
  if (hay.includes("cbeth")) return "https://www.coinbase.com/earn";
  if (hay.includes("weeth") || hay.includes("ether.fi")) return "https://app.ether.fi/";
  if (hay.includes("savax") || hay.includes("benqi")) return "https://staking.benqi.fi/";
  if (hay.includes("linear") || hay.includes("linear-protocol") || (opts.chainId === 397 && /\blst\b/i.test(opts.symbol ?? ""))) return "https://app.linearprotocol.org/";
  if (hay.includes("stnear") || hay.includes("meta-pool") || hay.includes("meta pool")) return "https://app.metapool.app/";
  if (hay.includes("msol") || hay.includes("marinade")) return "https://marinade.finance/app/staking";
  if (hay.includes("jitosol") || hay.includes("jito")) return "https://www.jito.network/staking/";
  if (hay.includes("bsol") || hay.includes("blaze")) return "https://stake.solblaze.org/";
  if (opts.chainId === 397 && opts.contract) return `https://nearblocks.io/address/${opts.contract}`;
  if (opts.chainId === 1815 && opts.contract?.startsWith("pool")) return `https://cardanoscan.io/pool/${opts.contract}`;
  if (opts.chainId === 101 && opts.contract) return `https://solscan.io/account/${opts.contract}`;
  return undefined;
}
