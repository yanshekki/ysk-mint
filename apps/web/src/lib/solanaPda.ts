/**
 * Solana PDA + base58 without @solana/kit.
 * On-curve check is a trimmed noble-ed25519 (MIT, Paul Miller) as vendored by anza-xyz/kit.
 */

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const B58_MAP = new Uint8Array(128).fill(255);
for (let i = 0; i < B58.length; i++) B58_MAP[B58.charCodeAt(i)] = i;

const PDA_MARKER = new TextEncoder().encode("ProgramDerivedAddress");

const D = 37095705934669439343138083508754565189542113879843219016388785533085940283555n;
const P = 57896044618658097711785492504343953926634992332820282019728792003956564819949n;
const RM1 = 19681161376707505956807079304988542015446066515923890162744021073123829784752n;

function mod(a: bigint): bigint {
  const r = a % P;
  return r >= 0n ? r : P + r;
}

function pow2(x: bigint, power: bigint): bigint {
  let r = x;
  while (power-- > 0n) {
    r *= r;
    r %= P;
  }
  return r;
}

function pow_2_252_3(x: bigint): bigint {
  const x2 = (x * x) % P;
  const b2 = (x2 * x) % P;
  const b4 = (pow2(b2, 2n) * b2) % P;
  const b5 = (pow2(b4, 1n) * x) % P;
  const b10 = (pow2(b5, 5n) * b5) % P;
  const b20 = (pow2(b10, 10n) * b10) % P;
  const b40 = (pow2(b20, 20n) * b20) % P;
  const b80 = (pow2(b40, 40n) * b40) % P;
  const b160 = (pow2(b80, 80n) * b80) % P;
  const b240 = (pow2(b160, 80n) * b80) % P;
  const b250 = (pow2(b240, 10n) * b10) % P;
  return (pow2(b250, 2n) * x) % P;
}

function uvRatio(u: bigint, v: bigint): bigint | null {
  const v3 = mod(v * v * v);
  const v7 = mod(v3 * v3 * v);
  const pow = pow_2_252_3(u * v7);
  let x = mod(u * v3 * pow);
  const vx2 = mod(v * x * x);
  const root1 = x;
  const root2 = mod(x * RM1);
  const useRoot1 = vx2 === u;
  const useRoot2 = vx2 === mod(-u);
  const noRoot = vx2 === mod(-u * RM1);
  if (useRoot1) x = root1;
  if (useRoot2 || noRoot) x = root2;
  if ((mod(x) & 1n) === 1n) x = mod(-x);
  if (!useRoot1 && !useRoot2) return null;
  return x;
}

function pointIsOnCurve(y: bigint, lastByte: number): boolean {
  const y2 = mod(y * y);
  const u = mod(y2 - 1n);
  const v = mod(D * y2 + 1n);
  const x = uvRatio(u, v);
  if (x === null) return false;
  if (x === 0n && (lastByte & 0x80) !== 0) return false;
  return true;
}

function decompressY(bytes: Uint8Array): bigint {
  let hex = "";
  for (let i = 31; i >= 0; i--) {
    const b = i === 31 ? bytes[i]! & ~0x80 : bytes[i]!;
    hex += b.toString(16).padStart(2, "0");
  }
  return BigInt(`0x${hex}`);
}

export function isOnCurve(bytes: Uint8Array): boolean {
  if (bytes.length !== 32) return false;
  return pointIsOnCurve(decompressY(bytes), bytes[31]!);
}

export function encodeB58(bytes: Uint8Array): string {
  if (!bytes.length) return "";
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]!;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j]! * 256;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]!];
  return out;
}

export function decodeB58(s: string): Uint8Array | null {
  if (!s) return null;
  let zeros = 0;
  while (zeros < s.length && s[zeros] === "1") zeros++;
  const bytes = [0];
  for (let i = zeros; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const val = c < 128 ? B58_MAP[c]! : 255;
    if (val === 255) return null;
    let carry = val;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) out[out.length - 1 - i] = bytes[i]!;
  return out;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", copy));
}

export async function findPda(program: string, seeds: Uint8Array[]): Promise<string | null> {
  const programBytes = decodeB58(program);
  if (!programBytes || programBytes.length !== 32) return null;
  for (const seed of seeds) {
    if (seed.length > 32) return null;
  }
  for (let bump = 255; bump >= 0; bump--) {
    const parts: number[] = [];
    for (const seed of seeds) parts.push(...seed);
    parts.push(bump);
    parts.push(...programBytes);
    parts.push(...PDA_MARKER);
    const hash = await sha256(new Uint8Array(parts));
    if (!isOnCurve(hash)) return encodeB58(hash);
  }
  return null;
}

export async function sha256Utf8(s: string): Promise<Uint8Array> {
  return sha256(new TextEncoder().encode(s));
}

export const ZERO_32 = new Uint8Array(32);
