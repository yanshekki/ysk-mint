import type { ChainDefinition } from "@ysk-mint/config";

export function chainIcon(c: ChainDefinition): string {
  if (c.vm === "near") return "/tokens/near.png";
  if (c.vm === "cardano") return "/tokens/ada.png";
  if (c.vm === "solana") return "/tokens/sol.png";
  if (c.vm === "tron") return "/tokens/trx.png";
  if (c.vm === "sui") return "/tokens/sui.png";
  if (c.vm === "ton") return "/tokens/ton.png";
  if (c.vm === "aptos") return "/tokens/apt.png";
  if (c.vm === "hypercore") return "/tokens/hype.png";
  if (c.nativeSymbol === "BNB") return "/tokens/bnb.png";
  if (c.nativeSymbol === "AVAX") return "/tokens/avax.png";
  if (c.nativeSymbol === "POL") return "/tokens/pol.png";
  if (c.nativeSymbol === "FTM") return "/tokens/ftm.png";
  if (c.nativeSymbol === "MNT") return "/tokens/mnt.png";
  if (c.nativeSymbol === "HYPE") return "/tokens/hype.png";
  if (c.nativeSymbol === "CELO") return "/tokens/cmc-5567.png";
  if (c.nativeSymbol === "CRO") return "/tokens/cmc-3635.png";
  if (c.nativeSymbol === "SEI") return "/tokens/sei.png";
  if (c.nativeSymbol === "APE") return "/tokens/ape.png";
  if (c.chainId === 10) return "/tokens/op.png";
  if (c.chainId === 480) return "/tokens/wld.png";
  if (c.chainId === 42161 || c.chainId === 421614) return "/tokens/arb.png";
  return "/tokens/eth.png";
}
