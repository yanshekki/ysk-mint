import { CHAINS, chainByChainId } from "@ysk-mint/config";

export type RpcEndpoint = { id: string; name: string; url: string };

export const GLOBAL_RPC_PROVIDERS = ["official", "publicnode", "oneRpc", "drpc"] as const;
export type RpcGlobalProvider = (typeof GLOBAL_RPC_PROVIDERS)[number];

export const RPC_PROVIDER_LABEL: Record<string, string> = {
  official: "Official",
  publicnode: "PublicNode",
  oneRpc: "1RPC",
  drpc: "dRPC",
  llamarpc: "LlamaRPC",
  cloudflare: "Cloudflare",
  custom: "Custom",
  fastnear: "FastNEAR",
  lava: "Lava",
  leorpc: "LeoRPC",
  suiscan: "Suiscan",
  blockvision: "BlockVision",
  tonapi: "TONAPI",
  toncenter: "TON Center",
  trongrid: "TronGrid",
  koios: "Koios",
  aptoslabs: "Aptos Labs",
  alchemy: "Alchemy",
  proxy: "Local",
  blockstream: "Blockstream",
  mempool: "Mempool",
  xrplcluster: "XRPL Cluster",
  blastapi: "BlastAPI",
};

function ep(id: string, url: string): RpcEndpoint {
  return { id, name: RPC_PROVIDER_LABEL[id] ?? id, url };
}

const PUBLICNODE: Record<number, string> = {
  1: "https://ethereum-rpc.publicnode.com",
  8453: "https://base-rpc.publicnode.com",
  42161: "https://arbitrum-one-rpc.publicnode.com",
  10: "https://optimism-rpc.publicnode.com",
  56: "https://bsc-rpc.publicnode.com",
  43114: "https://avalanche-c-chain-rpc.publicnode.com",
  137: "https://polygon-bor-rpc.publicnode.com",
  250: "https://fantom-rpc.publicnode.com",
  100: "https://gnosis-rpc.publicnode.com",
  59144: "https://linea-rpc.publicnode.com",
  534352: "https://scroll-rpc.publicnode.com",
  146: "https://sonic-rpc.publicnode.com",
  204: "https://opbnb-rpc.publicnode.com",
  42220: "https://celo-rpc.publicnode.com",
  81457: "https://blast-rpc.publicnode.com",
  5000: "https://mantle-rpc.publicnode.com",
  1868: "https://soneium-rpc.publicnode.com",
  252: "https://fraxtal-rpc.publicnode.com",
  1088: "https://metis-rpc.publicnode.com",
  167000: "https://taiko-rpc.publicnode.com",
  130: "https://unichain-rpc.publicnode.com",
  80094: "https://berachain-rpc.publicnode.com",
  4663: "https://robinhood-chain-rpc.publicnode.com",
  101: "https://solana-rpc.publicnode.com",
  784: "https://sui-rpc.publicnode.com",
  11155111: "https://ethereum-sepolia-rpc.publicnode.com",
  84532: "https://base-sepolia-rpc.publicnode.com",
  97: "https://bsc-testnet-rpc.publicnode.com",
  43113: "https://avalanche-fuji-c-chain-rpc.publicnode.com",
};

const ONERPC: Record<number, string> = {
  1: "https://public.1rpc.io/eth",
  8453: "https://public.1rpc.io/base",
  42161: "https://public.1rpc.io/arb",
  10: "https://public.1rpc.io/op",
  56: "https://public.1rpc.io/bnb",
  137: "https://public.1rpc.io/matic",
  43114: "https://public.1rpc.io/avax",
  59144: "https://public.1rpc.io/linea",
  5000: "https://public.1rpc.io/mantle",
  34443: "https://public.1rpc.io/mode",
  324: "https://public.1rpc.io/zksync",
  100: "https://public.1rpc.io/gnosis",
  534352: "https://public.1rpc.io/scroll",
  81457: "https://public.1rpc.io/blast",
  167000: "https://public.1rpc.io/taiko",
  130: "https://public.1rpc.io/unichain",
  480: "https://public.1rpc.io/worldchain",
  42220: "https://public.1rpc.io/celo",
  204: "https://public.1rpc.io/opbnb",
  169: "https://public.1rpc.io/manta",
  252: "https://public.1rpc.io/fraxtal",
};

const DRPC: Record<number, string> = {
  1: "https://eth.drpc.org",
  8453: "https://base.drpc.org",
  42161: "https://arbitrum.drpc.org",
  10: "https://optimism.drpc.org",
  56: "https://bsc.drpc.org",
  43114: "https://avalanche.drpc.org",
  137: "https://polygon.drpc.org",
  250: "https://fantom.drpc.org",
  100: "https://gnosis.drpc.org",
  59144: "https://linea.drpc.org",
  534352: "https://scroll.drpc.org",
  146: "https://sonic.drpc.org",
  5000: "https://mantle.drpc.org",
  42220: "https://celo.drpc.org",
  204: "https://opbnb.drpc.org",
  324: "https://zksync.drpc.org",
  81457: "https://blast.drpc.org",
  130: "https://unichain.drpc.org",
  480: "https://worldchain.drpc.org",
  80094: "https://berachain.drpc.org",
  1329: "https://sei.drpc.org",
  25: "https://cronos.drpc.org",
  167000: "https://taiko.drpc.org",
  169: "https://manta.drpc.org",
  1088: "https://metis.drpc.org",
  60808: "https://bob.drpc.org",
  34443: "https://mode.drpc.org",
  252: "https://fraxtal.drpc.org",
  288: "https://boba.drpc.org",
  1135: "https://lisk.drpc.org",
  7777777: "https://zora.drpc.org",
  314: "https://filecoin.drpc.org",
  1868: "https://soneium.drpc.org",
  57073: "https://ink.drpc.org",
  2741: "https://abstract.drpc.org",
  196: "https://xlayer.drpc.org",
  33139: "https://apechain.drpc.org",
  397: "https://near.drpc.org",
  101: "https://solana.drpc.org",
  784: "https://sui.drpc.org",
  84532: "https://base-sepolia.drpc.org",
  11155111: "https://sepolia.drpc.org",
  421614: "https://arbitrum-sepolia.drpc.org",
};

const LLAMA: Record<number, string> = {
  1: "https://eth.llamarpc.com",
  8453: "https://base.llamarpc.com",
  42161: "https://arbitrum.llamarpc.com",
  10: "https://optimism.llamarpc.com",
  56: "https://binance.llamarpc.com",
  137: "https://polygon.llamarpc.com",
  43114: "https://avalanche.llamarpc.com",
  324: "https://zksync.llamarpc.com",
  59144: "https://linea.llamarpc.com",
  534352: "https://scroll.llamarpc.com",
  81457: "https://blast.llamarpc.com",
  100: "https://gnosis.llamarpc.com",
};

/** Extra branded public URLs that are not the four global maps. */
const NATIVE_EXTRA: Record<number, RpcEndpoint[]> = {
  1: [ep("cloudflare", "https://cloudflare-eth.com")],
  480: [ep("alchemy", "https://worldchain-mainnet.g.alchemy.com/public")],
  397: [ep("fastnear", "https://free.rpc.fastnear.com"), ep("lava", "https://near.lava.build")],
  784: [
    ep("suiscan", "https://rpc-mainnet.suiscan.xyz"),
    ep("blockvision", "https://sui-mainnet-endpoint.blockvision.org"),
  ],
  637: [ep("aptoslabs", "https://api.mainnet.aptoslabs.com/v1")],
  607: [ep("tonapi", "https://tonapi.io"), ep("toncenter", "https://toncenter.com/api/v2")],
  728126428: [ep("trongrid", "https://api.trongrid.io")],
  1815: [ep("koios", "https://api.koios.rest/api/v1")],
  18151: [ep("koios", "https://preprod.koios.rest/api/v1")],
  833: [ep("mempool", "https://mempool.space/api"), ep("blockstream", "https://blockstream.info/api")],
  144: [ep("xrplcluster", "https://xrplcluster.com")],
  100003: [ep("blastapi", "https://starknet-mainnet.public.blastapi.io")],
  118: [ep("publicnode", "https://cosmos-rest.publicnode.com")],
  100001: [ep("publicnode", "https://osmosis-rest.publicnode.com")],
  100002: [ep("publicnode", "https://celestia-rest.publicnode.com")],
};

export function normUrl(url: string) {
  return url.replace(/\/+$/, "").toLowerCase();
}

export function parseRpc(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  try {
    const u = new URL(s, typeof location !== "undefined" ? location.href : "https://local.invalid");
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    if (!u.hostname && !u.pathname.startsWith("/")) return undefined;
    return s;
  } catch {
    return undefined;
  }
}

export function providerIdFromUrl(url: string): string {
  try {
    const h = new URL(url, typeof location !== "undefined" ? location.href : "https://local.invalid").hostname.toLowerCase();
    if (h.includes("publicnode.com")) return "publicnode";
    if (h.includes("1rpc.io")) return "oneRpc";
    if (h.includes("drpc.org")) return "drpc";
    if (h.includes("llamarpc.com")) return "llamarpc";
    if (h.includes("cloudflare-eth.com")) return "cloudflare";
    if (h.includes("fastnear.com")) return "fastnear";
    if (h.includes("lava.build")) return "lava";
    if (h.includes("leorpc.com")) return "leorpc";
    if (h.includes("suiscan.xyz")) return "suiscan";
    if (h.includes("blockvision.org")) return "blockvision";
    if (h.includes("tonapi.io")) return "tonapi";
    if (h.includes("toncenter.com")) return "toncenter";
    if (h.includes("trongrid.io")) return "trongrid";
    if (h.includes("koios.rest")) return "koios";
    if (h.includes("aptoslabs.com")) return "aptoslabs";
    if (h.includes("alchemy.com")) return "alchemy";
    if (h.includes("mempool.space")) return "mempool";
    if (h.includes("blockstream.info")) return "blockstream";
    if (h.includes("xrplcluster.com")) return "xrplcluster";
    if (h.includes("blastapi.io")) return "blastapi";
  } catch {
    /* relative */
  }
  return "official";
}

export function rpcEndpoints(chainId: number): RpcEndpoint[] {
  const chain = chainByChainId(chainId) ?? Object.values(CHAINS).find((c) => c.chainId === chainId);
  const out: RpcEndpoint[] = [];
  const seen = new Set<string>();
  const push = (row: RpcEndpoint) => {
    const key = normUrl(row.url);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(row);
  };

  if (chain?.rpc) push(ep("official", chain.rpc));

  const branded = (id: string, url?: string) => {
    if (url) push(ep(id, url));
  };
  branded("publicnode", PUBLICNODE[chainId]);
  branded("oneRpc", ONERPC[chainId]);
  branded("drpc", DRPC[chainId]);
  branded("llamarpc", LLAMA[chainId]);

  for (const row of NATIVE_EXTRA[chainId] ?? []) push(row);

  if (
    (chainId === 1815 || chainId === 18151) &&
    typeof location !== "undefined" &&
    (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ) {
    out.unshift(ep("proxy", "/koios"));
  }

  return out;
}

export function endpointByUrl(chainId: number, url: string): RpcEndpoint | undefined {
  const key = normUrl(url);
  return rpcEndpoints(chainId).find((e) => normUrl(e.url) === key);
}
