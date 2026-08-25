import type { ChainDefinition } from "@ysk-mint/config";

export function chainIcon(c: ChainDefinition): string {
  if (c.vm === "near") return "/tokens/near.png";
  if (c.vm === "cardano") return "/tokens/ada.png";
  if (c.vm === "solana") return "/tokens/sol.png";
  if (c.nativeSymbol === "BNB") return "/tokens/bnb.png";
  if (c.nativeSymbol === "AVAX") return "/tokens/avax.png";
  if (c.chainId === 42161 || c.chainId === 421614) return "/tokens/arb.png";
  return "/tokens/eth.png";
}
