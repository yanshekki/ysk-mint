export type DexAppArgs = {
  name: string;
  protocolId?: string;
  chainId: number;
  pool: string;
  tokenA?: string;
  tokenB?: string;
  kind?: string;
};

const UNI: Record<number, string> = {
  1: "ethereum",
  10: "optimism",
  56: "bnb",
  100: "gnosis",
  130: "unichain",
  137: "polygon",
  324: "zksync",
  480: "worldchain",
  8453: "base",
  42161: "arbitrum",
  43114: "avalanche",
  42220: "celo",
  1868: "soneium",
  59144: "linea",
  534352: "scroll",
  81457: "blast",
};

const CAKE: Record<number, string> = {
  1: "eth",
  56: "bsc",
  324: "zksync",
  8453: "base",
  42161: "arb",
  59144: "linea",
};

const CURVE: Record<number, string> = {
  1: "ethereum",
  10: "optimism",
  56: "bsc",
  100: "xdai",
  137: "polygon",
  146: "sonic",
  8453: "base",
  42161: "arbitrum",
  42220: "celo",
  43114: "avalanche",
};

const SUSHI: Record<number, string> = {
  1: "ethereum",
  10: "optimism",
  56: "bsc",
  137: "polygon",
  8453: "base",
  42161: "arbitrum",
};

function hay({ name, protocolId }: DexAppArgs) {
  return `${protocolId ?? ""} ${name}`.toLowerCase();
}

export function dexAppHref(args: DexAppArgs): string | undefined {
  const h = hay(args);
  const pool = args.pool;
  const a = args.tokenA ?? "";
  const b = args.tokenB ?? "";
  const uni = UNI[args.chainId];
  const cake = CAKE[args.chainId];

  if (h.includes("uniswap") && uni) return `https://app.uniswap.org/explore/pools/${uni}/${pool}`;
  if (h.includes("pancake") && cake) {
    const v3 = h.includes("v3") || args.kind === "v3";
    return v3
      ? `https://pancakeswap.finance/liquidity/${pool}?chain=${cake}`
      : `https://pancakeswap.finance/info/v2/pairs/${pool}?chain=${cake}`;
  }
  if (h.includes("trader joe") || h.startsWith("joe-") || h.includes(" joe")) {
    if (args.chainId === 43114 && a && b) return `https://lfj.gg/avalanche/pool/v1/${a}/${b}`;
    return "https://lfj.gg/";
  }
  if (h.includes("pangolin")) {
    if (a && b) return `https://app.pangolin.exchange/#/add/${a}/${b}`;
    return "https://app.pangolin.exchange/";
  }
  if (h.includes("curve")) {
    const c = CURVE[args.chainId];
    return c ? `https://www.curve.finance/dex/${c}/pools` : "https://www.curve.finance/";
  }
  if (h.includes("balancer") || h.includes("beets")) return "https://balancer.fi/pools";
  if (h.includes("aerodrome") || h.includes("slipstream")) {
    if (a && b) return `https://aerodrome.finance/deposit?token0=${a}&token1=${b}`;
    return "https://aerodrome.finance/";
  }
  if (h.includes("velodrome")) {
    if (a && b) return `https://velodrome.finance/deposit?token0=${a}&token1=${b}`;
    return "https://velodrome.finance/";
  }
  if (h.includes("blackhole")) return "https://blackhole.xyz/";
  if (h.includes("sushi")) {
    const s = SUSHI[args.chainId] ?? "ethereum";
    return `https://www.sushi.com/${s}/pool/v2/${pool}`;
  }
  if (h.includes("camelot")) return a && b ? `https://app.camelot.exchange/liquidity/${a}/${b}` : "https://app.camelot.exchange/";
  if (h.includes("quick")) return "https://quickswap.exchange/#/pools";
  if (h.includes("thena")) return "https://thena.fi/liquidity";
  if (h.includes("ramses")) return "https://ramses.exchange/liquidity";
  if (h.includes("biswap")) return "https://biswap.org/pool";
  if (h.includes("apeswap")) return "https://apeswap.finance/add-liquidity";
  if (h.includes("syncswap")) return "https://syncswap.xyz/pool";
  if (h.includes("shadow")) return "https://www.shadow.so/liquidity";
  if (h.includes("kodiak")) return "https://app.kodiak.finance/#/liquidity";
  if (h.includes("hyperswap")) return "https://app.hyperswap.exchange/#/pool";
  if (h.includes("zkswap")) return "https://zkswap.finance/pool";
  if (h.includes("solidlizard")) return "https://solidlizard.finance/liquidity";
  if (h.includes("zyber")) return "https://www.zyberswap.io/exchange/pool";
  if (h.includes("verse")) return "https://verse.bitcoin.com/pools";
  if (h.includes("xswap")) return "https://app.xspswap.finance/pool";
  if (h.includes("katana")) return "https://katana.roninchain.com/";
  if (h.includes("thruster")) return "https://app.thruster.finance/";
  if (h.includes("algebra")) return undefined;
  if (args.protocolId === "rhea-ref-397" || h.includes("rhea") || h.includes("ref finance")) {
    const raw = String(pool);
    const sauce = /^sauce:/i.test(raw);
    const id = raw.replace(/^(ref:|sauce:)/i, "");
    if (!/^\d+$/.test(id)) return "https://app.rhea.finance/pools";
    return `https://app.rhea.finance/${sauce ? "sauce" : "pool"}/${id}`;
  }
  if (h.includes("minswap")) return "https://app.minswap.org/liquidity";
  if (h.includes("cetus")) return "https://app.cetus.zone/pools";
  if (h.includes("ston")) return "https://app.ston.fi/pools";
  if (h.includes("raydium")) return "https://raydium.io/liquidity-pools/";
  if (h.includes("orca")) return "https://www.orca.so/pools";
  if (h.includes("meteora")) return "https://app.meteora.ag/pools";
  if (h.includes("jupiter")) return "https://jup.ag/";
  return undefined;
}

export function dexBrandHref(name: string, _chainId = 1): string | undefined {
  const h = name.toLowerCase();
  if (h.includes("uniswap")) return "https://app.uniswap.org/positions";
  if (h.includes("pancake")) return "https://pancakeswap.finance/liquidity/pools";
  if (h.includes("trader joe") || h.includes("lfj") || h.includes(" joe")) return "https://lfj.gg/";
  if (h.includes("pangolin")) return "https://app.pangolin.exchange/#/pool";
  if (h.includes("sush")) return "https://www.sushi.com/pool";
  if (h.includes("curve")) return "https://www.curve.finance/";
  if (h.includes("balancer")) return "https://balancer.fi/pools";
  if (h.includes("aerodrome")) return "https://aerodrome.finance/";
  if (h.includes("velodrome")) return "https://velodrome.finance/";
  if (h.includes("camelot")) return "https://app.camelot.exchange/liquidity";
  if (h.includes("raydium")) return "https://raydium.io/portfolio/";
  if (h.includes("orca")) return "https://www.orca.so/portfolio";
  if (h.includes("cetus")) return "https://app.cetus.zone/portfolio";
  if (h.includes("minswap")) return "https://app.minswap.org/liquidity";
  return undefined;
}
