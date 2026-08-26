import { isCardanoAddress } from "@ysk-mint/sdk";

export type CardanoWalletInfo = { id: string; name: string; icon?: string };

type Cip30Enabled = {
  getChangeAddress(): Promise<string>;
  getUsedAddresses(): Promise<string[]>;
  getUnusedAddresses?: () => Promise<string[]>;
  getRewardAddresses?: () => Promise<string[]>;
  getBalance?: () => Promise<string>;
  getUtxos?: (amount?: string) => Promise<string[] | null>;
};

export type CardanoValue = { ada: bigint; assets: Map<string, bigint> };

let enabledApi: Cip30Enabled | null = null;
let cipEpoch = 0;
const cipListeners = new Set<() => void>();

export function cardanoApi() {
  return enabledApi;
}

export function cipEpochNow() {
  return cipEpoch;
}

export function subscribeCip(fn: () => void) {
  cipListeners.add(fn);
  return () => {
    cipListeners.delete(fn);
  };
}

function bumpCip() {
  cipEpoch += 1;
  for (const fn of cipListeners) fn();
}

export function clearCardanoApi() {
  enabledApi = null;
  bumpCip();
}

export type CardanoSession = {
  address: string;
  addresses: string[];
  stake: string;
};

type Cip30Injected = {
  name?: string;
  icon?: string;
  enable: (opts?: unknown) => Promise<Cip30Enabled>;
  isEnabled?: () => Promise<boolean>;
};

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32_GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values: number[]) {
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= BECH32_GEN[i]!;
  }
  return chk;
}

function hrpExpand(hrp: string) {
  const out: number[] = [];
  for (const c of hrp) out.push(c.charCodeAt(0) >> 5);
  out.push(0);
  for (const c of hrp) out.push(c.charCodeAt(0) & 31);
  return out;
}

function toWords(bytes: Uint8Array) {
  let acc = 0;
  let bits = 0;
  const words: number[] = [];
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      words.push((acc >> bits) & 31);
    }
  }
  if (bits > 0) words.push((acc << (5 - bits)) & 31);
  return words;
}

function encodeBech32(hrp: string, bytes: Uint8Array<ArrayBufferLike>) {
  const data = toWords(bytes);
  const checksumValues = [...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
  const mod = polymod(checksumValues) ^ 1;
  const checksum = Array.from({ length: 6 }, (_, i) => (mod >> (5 * (5 - i))) & 31);
  return `${hrp}1${[...data, ...checksum].map((d) => BECH32_CHARSET[d]).join("")}`;
}

function fromWords(words: number[]) {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  for (const w of words) {
    acc = (acc << 5) | w;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 255);
    }
  }
  return new Uint8Array(out);
}

function decodeBech32(addr: string): { hrp: string; bytes: Uint8Array } | null {
  const s = addr.trim().toLowerCase();
  const i = s.lastIndexOf("1");
  if (i < 1) return null;
  const hrp = s.slice(0, i);
  const data = s.slice(i + 1);
  const words: number[] = [];
  for (const c of data) {
    const v = BECH32_CHARSET.indexOf(c);
    if (v < 0) return null;
    words.push(v);
  }
  if (words.length < 7) return null;
  if (polymod([...hrpExpand(hrp), ...words]) !== 1) return null;
  return { hrp, bytes: fromWords(words.slice(0, -6)) };
}

export function addressToHex(addr: string): string {
  const decoded = decodeBech32(addr);
  if (!decoded) return "";
  return [...decoded.bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBech32(hrp: string, hex: string) {
  const clean = hex.replace(/^0x/, "");
  if (!clean || clean.length % 2) return "";
  return encodeBech32(hrp, hexToBytes(clean));
}

/** Shelley base address (types 0–3) embeds the stake credential. */
export function stakeFromPayment(addr: string): string {
  const decoded = decodeBech32(addr);
  if (!decoded || decoded.bytes.length < 57) return "";
  const type = decoded.bytes[0]! >> 4;
  const network = decoded.bytes[0]! & 0x0f;
  if (type > 3 || (network !== 0 && network !== 1)) return "";
  const header = (14 << 4) | network;
  const payload = new Uint8Array(29);
  payload[0] = header;
  payload.set(decoded.bytes.slice(29, 57), 1);
  return encodeBech32(network === 0 ? "stake_test" : "stake", payload);
}

function hexToBytes(hex: string) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function looksLikeAddressBytes(bytes: Uint8Array) {
  if (bytes.length < 28 || bytes.length > 128) return false;
  const type = bytes[0]! >> 4;
  const network = bytes[0]! & 0x0f;
  return (type <= 7 || type === 14 || type === 15) && (network === 0 || network === 1);
}

function unwrapCborBytes(bytes: Uint8Array) {
  if (!bytes.length) return bytes;
  const head = bytes[0]!;
  if (head >= 0x40 && head <= 0x57) return bytes.slice(1, 1 + (head - 0x40));
  if (head === 0x58 && bytes.length >= 2) return bytes.slice(2, 2 + bytes[1]!);
  if (head === 0x59 && bytes.length >= 3) {
    const len = (bytes[1]! << 8) | bytes[2]!;
    return bytes.slice(3, 3 + len);
  }
  return bytes;
}

function hrpFor(bytes: Uint8Array) {
  const type = bytes[0]! >> 4;
  const test = (bytes[0]! & 0x0f) === 0;
  if (type === 14 || type === 15) return test ? "stake_test" : "stake";
  return test ? "addr_test" : "addr";
}

/** CIP-30 returns hex (raw address or CBOR bytes) or already-bech32. */
export function cip30ToAddress(raw: string): string {
  const s = raw.trim();
  if (/^(addr1|addr_test1|stake1|stake_test1)[0-9a-z]+$/.test(s)) return s;
  const hex = s.replace(/^0x/i, "");
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) throw new Error("address");
  let bytes: Uint8Array = hexToBytes(hex);
  if (!looksLikeAddressBytes(bytes)) bytes = unwrapCborBytes(bytes);
  if (looksLikeAddressBytes(bytes)) return encodeBech32(hrpFor(bytes), bytes);
  if (isCardanoAddress(hex)) return hex;
  throw new Error("address");
}

function cardanoNamespace(): Record<string, Cip30Injected> {
  if (typeof window === "undefined") return {};
  const raw = (window as unknown as { cardano?: Record<string, unknown> }).cardano;
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, Cip30Injected>;
}

export function listCardanoWallets(): CardanoWalletInfo[] {
  return Object.entries(cardanoNamespace())
    .filter(([, wallet]) => wallet && typeof wallet.enable === "function")
    .map(([id, wallet]) => ({
      id,
      name: wallet.name || id,
      icon: typeof wallet.icon === "string" ? wallet.icon : undefined,
    }));
}

async function decodeList(raws: string[] | undefined): Promise<string[]> {
  const out: string[] = [];
  for (const raw of raws ?? []) {
    try {
      const addr = cip30ToAddress(raw);
      if (isCardanoAddress(addr) && !out.includes(addr)) out.push(addr);
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

export async function enableCardano(walletId: string): Promise<CardanoSession> {
  const wallet = cardanoNamespace()[walletId];
  if (!wallet) throw new Error("wallet");
  const api = await wallet.enable();
  const changeRaw = await api.getChangeAddress().catch(() => "");
  const used = await api.getUsedAddresses().catch(() => [] as string[]);
  const unused = api.getUnusedAddresses ? await api.getUnusedAddresses().catch(() => [] as string[]) : [];
  const rewards = api.getRewardAddresses ? await api.getRewardAddresses().catch(() => [] as string[]) : [];
  const payments = await decodeList([changeRaw, ...used, ...unused]);
  const stakes = (await decodeList(rewards)).filter((a) => a.startsWith("stake") || a.startsWith("stake_test"));
  let stake = stakes[0] ?? "";
  if (!stake) {
    for (const payment of payments) {
      stake = stakeFromPayment(payment);
      if (stake) break;
    }
  }
  const address = payments[0] ?? "";
  if (!address || !isCardanoAddress(address)) throw new Error("address");
  enabledApi = api;
  bumpCip();
  return { address, addresses: payments, stake };
}

/** Re-collect payment + stake if CIP-30 already authorized. Does not prompt. */
export async function refreshCardanoIfEnabled(walletId: string): Promise<CardanoSession | null> {
  const wallet = cardanoNamespace()[walletId];
  if (!wallet) return null;
  try {
    const enabled = wallet.isEnabled ? await wallet.isEnabled() : false;
    if (!enabled) return null;
    return await enableCardano(walletId);
  } catch {
    return null;
  }
}

class CborCursor {
  i = 0;
  constructor(readonly b: Uint8Array) {}
  take(n: number) {
    const slice = this.b.subarray(this.i, this.i + n);
    this.i += n;
    return slice;
  }
}

function cborLen(c: CborCursor, extra: number): number {
  if (extra < 24) return extra;
  if (extra === 24) return c.take(1)[0]!;
  if (extra === 25) {
    const v = c.take(2);
    return (v[0]! << 8) | v[1]!;
  }
  if (extra === 26) {
    const v = c.take(4);
    return (v[0]! << 24) | (v[1]! << 16) | (v[2]! << 8) | v[3]!;
  }
  if (extra === 27) {
    const v = c.take(8);
    let n = 0n;
    for (const x of v) n = (n << 8n) | BigInt(x);
    return Number(n);
  }
  throw new Error("cbor");
}

function cborUint(c: CborCursor, extra: number): bigint {
  if (extra < 24) return BigInt(extra);
  if (extra === 24) return BigInt(c.take(1)[0]!);
  if (extra === 25) {
    const v = c.take(2);
    return BigInt((v[0]! << 8) | v[1]!);
  }
  if (extra === 26) {
    const v = c.take(4);
    return BigInt(((v[0]! << 24) | (v[1]! << 16) | (v[2]! << 8) | v[3]!) >>> 0);
  }
  if (extra === 27) {
    const v = c.take(8);
    let n = 0n;
    for (const x of v) n = (n << 8n) | BigInt(x);
    return n;
  }
  throw new Error("cbor");
}

function cborItem(c: CborCursor): unknown {
  const ib = c.take(1)[0]!;
  const major = ib >> 5;
  const extra = ib & 31;
  if (major === 0) return cborUint(c, extra);
  if (major === 1) return -1n - cborUint(c, extra);
  if (major === 2) return c.take(cborLen(c, extra));
  if (major === 3) {
    c.take(cborLen(c, extra));
    return "";
  }
  if (major === 4) {
    const n = extra === 31 ? -1 : cborLen(c, extra);
    const arr: unknown[] = [];
    if (n < 0) {
      while (c.b[c.i] !== 0xff) arr.push(cborItem(c));
      c.take(1);
    } else {
      for (let i = 0; i < n; i++) arr.push(cborItem(c));
    }
    return arr;
  }
  if (major === 5) {
    const n = extra === 31 ? -1 : cborLen(c, extra);
    const map = new Map<unknown, unknown>();
    const push = () => {
      const k = cborItem(c);
      map.set(k, cborItem(c));
    };
    if (n < 0) {
      while (c.b[c.i] !== 0xff) push();
      c.take(1);
    } else {
      for (let i = 0; i < n; i++) push();
    }
    return map;
  }
  if (major === 6) {
    cborLen(c, extra);
    return cborItem(c);
  }
  if (major === 7) {
    if (extra === 20) return false;
    if (extra === 21) return true;
    if (extra === 22 || extra === 23) return null;
    if (extra === 31) return null;
    if (extra === 25) c.take(2);
    else if (extra === 26) c.take(4);
    else if (extra === 27) c.take(8);
    return 0n;
  }
  throw new Error("cbor");
}

function asBig(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  throw new Error("int");
}

function asBytes(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v;
  throw new Error("bytes");
}

function toHex(bytes: Uint8Array) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseValue(item: unknown): CardanoValue {
  if (item instanceof Uint8Array) return parseValue(cborItem(new CborCursor(item)));
  if (typeof item === "bigint" || typeof item === "number") {
    return { ada: asBig(item), assets: new Map() };
  }
  if (Array.isArray(item) && item.length >= 1) {
    const ada = asBig(item[0]);
    const assets = new Map<string, bigint>();
    const ma = item[1];
    if (ma instanceof Map) {
      for (const [policy, names] of ma) {
        const p = toHex(asBytes(policy));
        if (!(names instanceof Map)) continue;
        for (const [name, qty] of names) {
          assets.set(`${p}${toHex(asBytes(name))}`, asBig(qty));
        }
      }
    }
    return { ada, assets };
  }
  throw new Error("value");
}

function valueFromUtxo(item: unknown): CardanoValue {
  if (!Array.isArray(item) || item.length < 2) throw new Error("utxo");
  const output = item[1];
  if (Array.isArray(output) && output.length >= 2) return parseValue(output[1]);
  if (output instanceof Map) {
    const amount = output.get(1) ?? output.get(1n);
    if (amount !== undefined) return parseValue(amount);
  }
  throw new Error("utxo");
}

function mergeValue(into: CardanoValue, add: CardanoValue) {
  into.ada += add.ada;
  for (const [unit, qty] of add.assets) into.assets.set(unit, (into.assets.get(unit) ?? 0n) + qty);
}

function decodeHexCbor(hex: string): unknown {
  const raw = hex.replace(/^0x/i, "");
  if (!/^[0-9a-f]+$/i.test(raw) || raw.length % 2) throw new Error("hex");
  return cborItem(new CborCursor(hexToBytes(raw)));
}

export async function readCardanoValue(): Promise<CardanoValue | null> {
  const api = enabledApi;
  if (!api) return null;
  try {
    if (api.getBalance) {
      const hex = await api.getBalance();
      if (hex) return parseValue(decodeHexCbor(hex));
    }
  } catch {
    /* try utxos */
  }
  try {
    const utxos = (await api.getUtxos?.()) ?? [];
    if (!utxos.length) return null;
    const total: CardanoValue = { ada: 0n, assets: new Map() };
    for (const hex of utxos) {
      try {
        mergeValue(total, valueFromUtxo(decodeHexCbor(hex)));
      } catch {
        /* skip malformed utxo */
      }
    }
    return total;
  } catch {
    return null;
  }
}
