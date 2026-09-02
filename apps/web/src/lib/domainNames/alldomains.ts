import { rpcJsonRpc } from "../rpcPool.ts";
import { decodeB58, encodeB58, findPda, sha256Utf8, ZERO_32 } from "../solanaPda.ts";
import type { DomainResolver } from "./types.ts";

const ANS_PROGRAM = "ALTNSZ46uaAUU7XUV6awvdorLGqAsPwa9shm7h4uP2FK";
const TLD_HOUSE_PROGRAM = "TLDHkysf5pCnKsVA4gXpNvmy7psXLPEu4LAdDJthT9S";
const NAME_HOUSE_PROGRAM = "NH3uX6FtVE2fNREAioP7hm5RaozotZxeL6khU1EHx51";
export const ROOT_ANS = "3mX9b4AZaQehNoQGfckVcmgmA6bkBoFcbLj9RMmMyNcU";
const HASH_PREFIX = "ALT Name Service";
const HEADER_SIZE = 200;
const OWNER_OFFSET = 40;
const EXPIRES_AT_OFFSET = 104;

/** TLDs people actually type. Other AllDomains TLDs resolve if the parent account exists. */
export const ALLDOMAINS_TLDS = [".skr", ".abc", ".bonk", ".poor", ".solana"] as const;

const parentCache = new Map<string, string | null>();

function utf8(s: string) {
  return new TextEncoder().encode(s);
}

async function hashName(name: string) {
  return sha256Utf8(HASH_PREFIX + name);
}

async function deriveNameAccount(name: string, parent?: string) {
  const parentBytes = parent ? decodeB58(parent) : ZERO_32;
  if (!parentBytes || parentBytes.length !== 32) return null;
  return findPda(ANS_PROGRAM, [await hashName(name), ZERO_32, parentBytes]);
}

async function deriveTldHouse(tld: string) {
  const dotted = tld.startsWith(".") ? tld : `.${tld}`;
  return findPda(TLD_HOUSE_PROGRAM, [utf8("tld_house"), utf8(dotted)]);
}

async function deriveReverseAccount(nameAccount: string, tldHouse: string) {
  const houseBytes = decodeB58(tldHouse);
  if (!houseBytes) return null;
  return findPda(ANS_PROGRAM, [await hashName(nameAccount), houseBytes, ZERO_32]);
}

async function deriveNftRecord(nameAccount: string, tldHouse: string) {
  const houseBytes = decodeB58(tldHouse);
  const nameBytes = decodeB58(nameAccount);
  if (!houseBytes || !nameBytes) return null;
  const nameHouse = await findPda(NAME_HOUSE_PROGRAM, [utf8("name_house"), houseBytes]);
  if (!nameHouse) return null;
  const nhBytes = decodeB58(nameHouse);
  if (!nhBytes) return null;
  return findPda(NAME_HOUSE_PROGRAM, [utf8("nft_record"), nhBytes, nameBytes]);
}

type AccInfo = { value?: { data?: [string, string] } | null } | null;

async function accountBytes(pubkey: string): Promise<Uint8Array | null> {
  try {
    const info = await rpcJsonRpc<AccInfo>(101, "getAccountInfo", [pubkey, { encoding: "base64" }]);
    const b64 = info?.value?.data?.[0];
    if (!b64) return null;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function ownerFromHeader(data: Uint8Array): string | null {
  if (data.length < HEADER_SIZE) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const expiresAt = Number(view.getBigUint64(EXPIRES_AT_OFFSET, true));
  if (expiresAt !== 0 && expiresAt * 1000 < Date.now()) return null;
  return encodeB58(data.subarray(OWNER_OFFSET, OWNER_OFFSET + 32));
}

async function resolveTokenizedOwner(nftRecord: string): Promise<string | null> {
  const data = await accountBytes(nftRecord);
  if (!data || data.length < 106 || data[8] !== 1) return null;
  const mint = encodeB58(data.subarray(74, 106));
  try {
    const largest = await rpcJsonRpc<{ value?: Array<{ address?: string }> }>(101, "getTokenLargestAccounts", [mint]);
    const ata = largest?.value?.[0]?.address;
    if (!ata) return null;
    const info = await rpcJsonRpc<{
      value?: { data?: { parsed?: { info?: { owner?: string } } } };
    }>(101, "getAccountInfo", [ata, { encoding: "jsonParsed" }]);
    return info?.value?.data?.parsed?.info?.owner || null;
  } catch {
    return null;
  }
}

export async function tldParent(tld: string): Promise<string | null> {
  const dotted = (tld.startsWith(".") ? tld : `.${tld}`).toLowerCase();
  if (parentCache.has(dotted)) return parentCache.get(dotted) ?? null;
  const parent = await deriveNameAccount(dotted, ROOT_ANS);
  if (!parent) {
    parentCache.set(dotted, null);
    return null;
  }
  const data = await accountBytes(parent);
  const ok = data && data.length >= HEADER_SIZE ? parent : null;
  parentCache.set(dotted, ok);
  return ok;
}

function splitDomain(name: string): { label: string; tld: string } | null {
  const n = name.trim().toLowerCase().replace(/^@/, "");
  const i = n.lastIndexOf(".");
  if (i <= 0 || i === n.length - 1) return null;
  const tld = n.slice(i);
  const label = n.slice(0, i);
  if (!/^[a-z0-9-]{1,63}$/.test(label)) return null;
  if (label.includes(".")) return null;
  return { label, tld };
}

export async function resolveAllDomains(name: string): Promise<string | null> {
  const parts = splitDomain(name);
  if (!parts) return null;
  const parent = await tldParent(parts.tld);
  if (!parent) return null;
  const nameAccount = await deriveNameAccount(parts.label, parent);
  if (!nameAccount) return null;
  const data = await accountBytes(nameAccount);
  if (!data) return null;
  const owner = ownerFromHeader(data);
  if (!owner) return null;
  const tldHouse = await deriveTldHouse(parts.tld);
  if (tldHouse) {
    const nftRecord = await deriveNftRecord(nameAccount, tldHouse);
    if (nftRecord && owner === nftRecord) return resolveTokenizedOwner(nftRecord);
  }
  return owner;
}

type GpaRow = { pubkey?: string };

async function namesForTld(owner: string, tld: string): Promise<string[]> {
  const parent = await tldParent(tld);
  if (!parent) return [];
  const tldHouse = await deriveTldHouse(tld);
  try {
    const accounts = await rpcJsonRpc<GpaRow[]>(101, "getProgramAccounts", [
      ANS_PROGRAM,
      {
        encoding: "base64",
        dataSlice: { offset: 0, length: 0 },
        filters: [
          { memcmp: { offset: 8, bytes: parent } },
          { memcmp: { offset: OWNER_OFFSET, bytes: owner } },
        ],
      },
    ]);
    const list = Array.isArray(accounts) ? accounts : [];
    const names: string[] = [];
    for (const row of list.slice(0, 8)) {
      const pk = row.pubkey;
      if (!pk || !tldHouse) continue;
      const reverse = await deriveReverseAccount(pk, tldHouse);
      if (!reverse) continue;
      const data = await accountBytes(reverse);
      if (!data || data.length <= HEADER_SIZE) continue;
      const label = new TextDecoder().decode(data.subarray(HEADER_SIZE)).replace(/\0.*$/, "").trim();
      if (label) names.push(`${label}${tld.startsWith(".") ? tld : `.${tld}`}`);
    }
    return names.sort();
  } catch {
    return [];
  }
}

export async function reverseAllDomains(address: string): Promise<string | null> {
  for (const tld of ALLDOMAINS_TLDS) {
    const names = await namesForTld(address, tld);
    if (names[0]) return names[0];
  }
  return null;
}

/** Self-check: hashing + seed order for the ANS root. */
export async function ansRootPda(): Promise<string | null> {
  return deriveNameAccount("ANS");
}

export const allDomainsResolver: DomainResolver = {
  id: "alldomains",
  kind: "solana",
  tlds: [...ALLDOMAINS_TLDS],
  resolve: resolveAllDomains,
  reverse: reverseAllDomains,
};
