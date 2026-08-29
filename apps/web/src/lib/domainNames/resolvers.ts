import { createPublicClient, isAddress } from "viem";
import { mainnet } from "viem/chains";
import { getEnsAddress, getEnsName, normalize } from "viem/ens";
import { stakeFromPayment } from "../cardanoCip30.ts";
import { outboundFetch } from "../outbound.ts";
import { jsonGet, stripTld } from "./http.ts";
import { liveTransport } from "../rpc.ts";
import { rpcJsonRpc } from "../rpcPool.ts";
import type { DomainResolver } from "./types.ts";

const eth = createPublicClient({
  chain: mainnet,
  transport: liveTransport(1),
});

const SPACE_TLDS = [".bnb", ".arb", ".manta", ".mode", ".gno", ".taiko", ".mint", ".merlin", ".four", ".ll", ".zeta", ".alien"];
const SPACE_CHAINS = [1, 56, 42161, 8453, 169, 100, 34443, 167000, 185, 4200];

const ICNS_LCD = "https://lcd.osmosis.zone";
const ICNS_RESOLVER = "osmo1xk0s8xgktn9x5vwcgtjdxqzadg88fgn33p8u9cnpdxwemvxscvast52cdd";
const STARGAZE_LCD = "https://rest.stargaze-apis.com";
const STARGAZE_NAMES = "stars1fx74nkqkw2748av8j7ew7r3xt9cgjqduwn8m0ur5lhe49uhlsasszc5fhr";

function b64(obj: unknown) {
  return btoa(JSON.stringify(obj));
}

async function wasmQuery<T>(lcd: string, contract: string, query: unknown): Promise<T | null> {
  const url = `${lcd}/cosmwasm/wasm/v1/contract/${contract}/smart/${b64(query)}`;
  const json = await jsonGet<{ data?: T }>(url);
  return json?.data ?? null;
}

async function web3bioNs(identity: string): Promise<{ address?: string; identity?: string } | null> {
  const json = await jsonGet<{ address?: string; identity?: string } | Array<{ address?: string; identity?: string }>>(
    `https://api.web3.bio/ns/${encodeURIComponent(identity)}`,
  );
  if (!json) return null;
  const row = Array.isArray(json) ? json[0] : json;
  return row ?? null;
}

export const ensResolver: DomainResolver = {
  id: "ens",
  kind: "evm",
  tlds: [".eth"],
  async resolve(name) {
    try {
      const addr = await getEnsAddress(eth, { name: normalize(name) });
      if (addr && isAddress(addr)) return addr;
    } catch {
      /* ccip / not found */
    }
    const bio = await web3bioNs(name);
    return bio?.address && isAddress(bio.address) ? bio.address : null;
  },
  async reverse(address) {
    if (!isAddress(address)) return null;
    try {
      const name = await getEnsName(eth, { address });
      if (name) return name;
    } catch {
      /* no primary */
    }
    const bio = await web3bioNs(address);
    const id = bio?.identity;
    return id && /\.eth$/i.test(id) ? id : null;
  },
};

export const spaceIdResolver: DomainResolver = {
  id: "space-id",
  kind: "evm",
  tlds: SPACE_TLDS,
  async resolve(name) {
    const json = await jsonGet<{ address?: string; code?: number }>(`https://nameapi.space.id/getAddress?domain=${encodeURIComponent(name)}`);
    const addr = json?.address;
    if (addr && isAddress(addr)) return addr;
    const bio = await web3bioNs(name);
    return bio?.address && isAddress(bio.address) ? bio.address : null;
  },
  async reverse(address) {
    for (const chainid of SPACE_CHAINS) {
      const json = await jsonGet<{ name?: string }>(`https://nameapi.space.id/getName?chainid=${chainid}&address=${address}`);
      if (json?.name) return json.name;
    }
    const bio = await web3bioNs(address);
    return bio?.identity && !/\.eth$/i.test(bio.identity) ? bio.identity : null;
  },
};

export const snsResolver: DomainResolver = {
  id: "sns",
  kind: "solana",
  tlds: [".sol"],
  async resolve(name) {
    const json = await jsonGet<{ result?: string; pubkey?: string } | string>(`https://sns-sdk-proxy.bonfida.org/resolve/${encodeURIComponent(name)}`);
    if (typeof json === "string" && json.length >= 32) return json;
    const pk = json && typeof json === "object" ? (json.result || json.pubkey) : undefined;
    if (pk && pk.length >= 32) return pk;
    const bio = await web3bioNs(name);
    return bio?.address || null;
  },
  async reverse(address) {
    const json = await jsonGet<{ result?: string; domain?: string }>(`https://sns-sdk-proxy.bonfida.org/primary-domain/${encodeURIComponent(address)}`);
    const n = json?.result || json?.domain;
    if (n) return n.endsWith(".sol") ? n : `${n}.sol`;
    const bio = await web3bioNs(address);
    const id = bio?.identity;
    return id && /\.sol$/i.test(id) ? id : null;
  },
};

export const adaHandleResolver: DomainResolver = {
  id: "ada-handle",
  kind: "cardano",
  tlds: ["$"],
  async resolve(name) {
    const handle = name.trim().replace(/^\$/, "");
    if (!handle) return null;
    const json = await jsonGet<{
      resolved_addresses?: { ada?: string };
      holder?: string;
    }>(`https://api.handle.me/handles/${encodeURIComponent(handle)}`);
    return json?.resolved_addresses?.ada || json?.holder || null;
  },
  async reverse(address) {
    const key = address.startsWith("stake") ? address : stakeFromPayment(address);
    if (!key.startsWith("stake")) return null;
    const json = await jsonGet<{ default_handle?: string; handles?: string[] }>(`https://api.handle.me/holders/${encodeURIComponent(key)}`);
    const handle = json?.default_handle || json?.handles?.[0];
    return handle ? `$${handle}` : null;
  },
};

export const suinsResolver: DomainResolver = {
  id: "suins",
  kind: "sui",
  tlds: [".sui"],
  async resolve(name) {
    try {
      const result = await rpcJsonRpc<string | null>(784, "suix_resolveNameServiceAddress", [name]);
      return result || null;
    } catch {
      return null;
    }
  },
  async reverse(address) {
    try {
      const result = await rpcJsonRpc<{ data?: string[] } | string[]>(784, "suix_resolveNameServiceNames", [address]);
      const data = Array.isArray(result) ? result : result?.data;
      return data?.[0] || null;
    } catch {
      return null;
    }
  },
};

export const aptosNamesResolver: DomainResolver = {
  id: "aptos-names",
  kind: "aptos",
  tlds: [".apt"],
  async resolve(name) {
    const label = stripTld(name, ".apt");
    const json = await jsonGet<{ address?: string }>(`https://www.aptosnames.com/api/mainnet/v1/address/${encodeURIComponent(label)}`);
    return json?.address || null;
  },
  async reverse(address) {
    const json = await jsonGet<{ name?: string }>(`https://www.aptosnames.com/api/mainnet/v1/primary-name/${encodeURIComponent(address)}`);
    if (!json?.name) return null;
    return json.name.endsWith(".apt") ? json.name : `${json.name}.apt`;
  },
};

export const tonDnsResolver: DomainResolver = {
  id: "ton-dns",
  kind: "ton",
  tlds: [".ton", ".t.me"],
  async resolve(name) {
    const json = await jsonGet<{ wallet?: { address?: string } }>(`https://tonapi.io/v2/dns/${encodeURIComponent(name)}/resolve`);
    return json?.wallet?.address || null;
  },
  async reverse(address) {
    const json = await jsonGet<{ items?: Array<{ name?: string }> }>(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/dns/backresolve`);
    return json?.items?.[0]?.name || null;
  },
};

export const starknetIdResolver: DomainResolver = {
  id: "starknet-id",
  kind: "starknet",
  tlds: [".stark"],
  async resolve(name) {
    const json = await jsonGet<{ addr?: string; address?: string }>(`https://api.starknet.id/domain_to_addr?domain=${encodeURIComponent(name)}`);
    return json?.addr || json?.address || null;
  },
  async reverse(address) {
    const json = await jsonGet<{ domain?: string }>(`https://api.starknet.id/addr_to_domain?addr=${encodeURIComponent(address)}`);
    return json?.domain || null;
  },
};

const ICNS_PREFIX: Record<string, "cosmos" | "osmosis"> = {
  cosmos: "cosmos",
  osmo: "osmosis",
  juno: "cosmos",
};

export const icnsResolver: DomainResolver = {
  id: "icns",
  kind: "osmosis",
  tlds: [".osmo", ".cosmos", ".juno"],
  async resolve(name) {
    const n = name.trim().toLowerCase();
    const parts = n.split(".");
    const tld = parts.pop();
    const first = parts.join(".");
    if (!tld || !first) return null;
    const prefix = tld === "cosmos" ? "cosmos" : tld === "osmo" ? "osmo" : tld;
    const addr = await wasmQuery<string>(ICNS_LCD, ICNS_RESOLVER, { address_of: { bech32_prefix: prefix, first_name: first } });
    return addr || null;
  },
  async reverse(address) {
    const name = await wasmQuery<string>(ICNS_LCD, ICNS_RESOLVER, { primary_name: { address } });
    if (name) return name.includes(".") ? name : `${name}.osmo`;
    const sg = await wasmQuery<string>(STARGAZE_LCD, STARGAZE_NAMES, { name: { address } });
    return sg ? (sg.includes(".") ? sg : `${sg}.stars`) : null;
  },
};

export const stellarFedResolver: DomainResolver = {
  id: "stellar-fed",
  kind: "stellar",
  tlds: ["*"],
  async resolve(name) {
    const [user, domain] = name.split("*");
    if (!user || !domain) return null;
    const toml = await outboundFetch(`https://${domain}/.well-known/stellar.toml`).then((r) => (r.ok ? r.text() : "")).catch(() => "");
    const m = toml.match(/FEDERATION_SERVER\s*=\s*"([^"]+)"/i);
    if (!m?.[1]) return null;
    const url = `${m[1]}${m[1].includes("?") ? "&" : "?"}q=${encodeURIComponent(name)}&type=name`;
    const json = await jsonGet<{ account_id?: string }>(url);
    return json?.account_id || null;
  },
  async reverse() {
    return null;
  },
};

export const nearIdentityResolver: DomainResolver = {
  id: "near",
  kind: "near",
  tlds: [".near", ".tg"],
  async resolve(name) {
    return name.trim().toLowerCase();
  },
  async reverse(address) {
    return /\.(near|tg)$/i.test(address) ? address : null;
  },
};

/** Kind override for ICNS cosmos vs osmosis TLD. */
export function icnsKindForName(name: string): DomainResolver["kind"] {
  const tld = name.trim().toLowerCase().split(".").pop();
  return (tld && ICNS_PREFIX[tld]) || "osmosis";
}

export const RESOLVERS: DomainResolver[] = [
  ensResolver,
  spaceIdResolver,
  snsResolver,
  adaHandleResolver,
  suinsResolver,
  aptosNamesResolver,
  tonDnsResolver,
  starknetIdResolver,
  icnsResolver,
  stellarFedResolver,
  nearIdentityResolver,
];
