import { isCardanoAddress } from "@ysk-mint/sdk";

export type CardanoWalletInfo = { id: string; name: string; icon?: string };

type Cip30Enabled = {
  getChangeAddress(): Promise<string>;
  getUsedAddresses(): Promise<string[]>;
};

type Cip30Injected = {
  name?: string;
  icon?: string;
  enable: (opts?: unknown) => Promise<Cip30Enabled>;
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

export async function enableCardano(walletId: string): Promise<string> {
  const wallet = cardanoNamespace()[walletId];
  if (!wallet) throw new Error("wallet");
  const api = await wallet.enable();
  let raw = "";
  try {
    raw = await api.getChangeAddress();
  } catch {
    raw = "";
  }
  if (!raw) {
    const used = await api.getUsedAddresses();
    raw = used[0] ?? "";
  }
  const addr = cip30ToAddress(raw);
  if (!isCardanoAddress(addr)) throw new Error("address");
  return addr;
}
