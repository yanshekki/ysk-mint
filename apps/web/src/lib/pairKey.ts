import { getAddress } from "viem";

export type Addr = `0x${string}`;

export function asAddr(a: string): Addr {
  const hex = (a.startsWith("0x") || a.startsWith("0X") ? a : `0x${a}`) as Addr;
  try {
    return getAddress(hex);
  } catch {
    return getAddress(hex.toLowerCase() as Addr);
  }
}

export function canonAddr(a: string) {
  return a.toLowerCase() as Addr;
}

export function canonId(a: string) {
  return a.toLowerCase();
}

export function sortPair(a: string, b: string): [string, string] {
  const x = canonId(a);
  const y = canonId(b);
  return x < y ? [x, y] : [y, x];
}

/** `|` so NEAR account ids (`linear-protocol.near`) are not split. */
export function pairId(chainId: number, a: string, b: string) {
  const [x, y] = sortPair(a, b);
  return `${chainId}|${x}|${y}`;
}

export function parsePairId(id: string) {
  const [chain, a, b] = id.split("|");
  return { chainId: Number(chain), tokenA: a ?? "", tokenB: b ?? "" };
}
