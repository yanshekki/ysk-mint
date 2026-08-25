import { CHAINS } from "@ysk-mint/config";
import { ErrorCode, type LaunchError } from "../errors/codes";
import { err } from "../errors/decode";
import type { Locale } from "../errors/messages";
import { pad, type Address } from "viem";

export type DeployedOFT = {
  chainKey: number;
  address: Address;
};

export type PeerCall = {
  fromChainKey: number;
  from: Address;
  dstEid: number;
  peer: `0x${string}`;
};

export function toPeerBytes32(address: Address): `0x${string}` {
  return pad(address, { size: 32 });
}

/** Bidirectional setPeer calls. CREATE2 addresses are not assumed equal across chains. */
export function planPeerCalls(deployed: DeployedOFT[]): PeerCall[] {
  const calls: PeerCall[] = [];
  for (const from of deployed) {
    const fromChain = CHAINS[from.chainKey as keyof typeof CHAINS];
    if (!fromChain) continue;
    for (const to of deployed) {
      if (from.chainKey === to.chainKey) continue;
      const toChain = CHAINS[to.chainKey as keyof typeof CHAINS];
      if (!toChain) continue;
      calls.push({
        fromChainKey: from.chainKey,
        from: from.address,
        dstEid: toChain.eid,
        peer: toPeerBytes32(to.address),
      });
    }
  }
  return calls;
}

export function validateSupplySplit(
  total: bigint,
  parts: { chainKey: number; amount: bigint }[],
  locale: Locale = "en",
): LaunchError[] {
  if (parts.length === 0) return [err(ErrorCode.LengthMismatch, [], locale)];
  const sum = parts.reduce((acc, p) => acc + p.amount, 0n);
  if (sum !== total) return [err(ErrorCode.SupplyOverflow, [sum, total], locale)];
  return [];
}
