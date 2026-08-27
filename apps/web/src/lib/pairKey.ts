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

export function sortPair(a: string, b: string): [Addr, Addr] {
  const x = canonAddr(a);
  const y = canonAddr(b);
  return x < y ? [x, y] : [y, x];
}

export function pairId(chainId: number, a: string, b: string) {
  const [x, y] = sortPair(a, b);
  return `${chainId}:${x}-${y}`;
}

export function parsePairId(id: string) {
  const [chain, rest] = id.split(":");
  const [a, b] = (rest || "").split("-");
  return { chainId: Number(chain), tokenA: a as Addr, tokenB: b as Addr };
}
