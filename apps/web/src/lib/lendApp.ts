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
  if (p === "curve") return "https://www.curve.finance/lend";
  if (p === "save" || p === "solend") return "https://save.finance/";
  return undefined;
}

export function stakeBrandName(opts: { symbol?: string; extra?: string; name?: string; chainId?: number; contract?: string }): string {
  const hay = `${opts.symbol ?? ""} ${opts.extra ?? ""} ${opts.name ?? ""} ${opts.contract ?? ""}`.toLowerCase();
  if (hay.includes("beacon") || hay.includes("0x00000000219ab540356cbb839cbe05303d7705fa")) return "Ethereum";
  if (hay.includes("khype") || hay.includes("kmhype") || hay.includes("vkhype") || hay.includes("kinetiq")) return "Kinetiq";
  if (hay.includes("behype") || hay.includes("hyperbeat")) return "Hyperbeat";
  if (hay.includes("hyperliquid") || hay.includes("hypercore") || opts.chainId === 998) return "Hyperliquid";
  if (hay.includes("stkaave") || hay.includes("safety module")) return "Aave";
  if (hay.includes("steth") || hay.includes("wsteth") || hay.includes("lido")) return "Lido";
  if (hay.includes("weeth") || hay.includes("ether.fi") || /\beeth\b/.test(hay)) return "ether.fi";
  if (hay.includes("ankreth") || hay.includes("ankr eth")) return "Ankr";
  if (hay.includes("rseth") || hay.includes("kelp")) return "Kelp";
  if (hay.includes("ezeth") || hay.includes("renzo")) return "Renzo";
  if (hay.includes("pufeth") || hay.includes("puffer")) return "Puffer";
  if (hay.includes("rsweth") || hay.includes("sweth") || hay.includes("swell")) return "Swell";
  if (hay.includes("ethx") || hay.includes("stader")) return "Stader";
  if (hay.includes("oseth") || hay.includes("stakewise")) return "StakeWise";
  if (hay.includes("sfrxeth") || hay.includes("frxeth")) return "Frax";
  if (hay.includes("cbeth")) return "Coinbase";
  if (/\breth\b/.test(hay) || hay.includes("rocket")) return "Rocket Pool";
  if (hay.includes("p-avax") || hay.includes("p-chain") || hay.includes("avalanche p")) return "Avalanche";
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
  if (hay.includes("beacon") || hay.includes("0x00000000219ab540356cbb839cbe05303d7705fa")) return "https://launchpad.ethereum.org";
  if (hay.includes("khype") || hay.includes("kmhype") || hay.includes("vkhype") || hay.includes("kinetiq")) return "https://kinetiq.xyz/stake";
  if (hay.includes("behype") || hay.includes("hyperbeat")) return "https://hyperbeat.co/staking";
  if (hay.includes("hyperliquid") || hay.includes("hypercore") || opts.chainId === 998) return "https://app.hyperliquid.xyz";
  if (hay.includes("stkaave") || hay.includes("safety module")) return "https://app.aave.com/staking";
  if (hay.includes("steth") || hay.includes("wsteth") || hay.includes("lido")) return "https://stake.lido.fi/";
  if (hay.includes("weeth") || hay.includes("ether.fi") || /\beeth\b/.test(hay)) return "https://app.ether.fi/";
  if (hay.includes("ankreth") || hay.includes("ankr eth")) return "https://www.ankr.com/staking/stake/ethereum/";
  if (hay.includes("rseth") || hay.includes("kelp")) return "https://kelpdao.xyz/";
  if (hay.includes("ezeth") || hay.includes("renzo")) return "https://app.renzoprotocol.com/";
  if (hay.includes("pufeth") || hay.includes("puffer")) return "https://app.puffer.fi/";
  if (hay.includes("rsweth") || hay.includes("sweth") || hay.includes("swell")) return "https://app.swellnetwork.io/";
  if (hay.includes("ethx") || hay.includes("stader")) return "https://www.staderlabs.com/";
  if (hay.includes("oseth") || hay.includes("stakewise")) return "https://app.stakewise.io/";
  if (hay.includes("sfrxeth") || hay.includes("frxeth")) return "https://app.frax.finance/staking/sfrxeth";
  if (hay.includes("cbeth")) return "https://www.coinbase.com/earn";
  if (/\breth\b/.test(hay) || hay.includes("rocket")) return "https://stake.rocketpool.net/";
  if (hay.includes("p-avax") || hay.includes("p-chain") || hay.includes("avalanche p")) return "https://wallet.avax.network/stake";
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
