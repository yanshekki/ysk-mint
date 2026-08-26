import type { DefiProtocol } from "./types.ts";

const all: DefiProtocol[] = [];
const byId = new Map<string, DefiProtocol>();

export function register(protocol: DefiProtocol) {
  if (byId.has(protocol.id)) return;
  byId.set(protocol.id, protocol);
  all.push(protocol);
}

export function protocolsOn(chainId: number) {
  return all.filter((p) => p.chainId === chainId);
}

export function allProtocols() {
  return all;
}
