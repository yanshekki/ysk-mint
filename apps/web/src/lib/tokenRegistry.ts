import cmc from "./cmcCatalog.json";

export type TokenVm = "evm" | "near" | "cardano" | "solana";

export type TokenRecord = {
  id: string;
  vm: TokenVm;
  chainId: number;
  symbol: string;
  name: string;
  decimals: number;
  address?: string;
  icon: string;
  native?: boolean;
};

const I = (file: string) => `/tokens/${file}.png`;

const NAT = (vm: TokenVm, chainId: number, id: string, symbol: string, name: string, decimals: number, icon: string): TokenRecord => ({
  id,
  vm,
  chainId,
  symbol,
  name,
  decimals,
  icon: I(icon),
  native: true,
});

/**
 * Native coins (always queried) plus CMC top-500 platform contracts
 * snapshotted 2026-08-26. Not the entire CMC universe.
 * Icons are local 64×64 copies. EVM decimals from on-chain eth_call.
 */
const NATIVES: TokenRecord[] = [
  NAT("evm", 1, "eth-native", "ETH", "Ethereum", 18, "eth"),
  NAT("evm", 8453, "base-native", "ETH", "Ethereum", 18, "eth"),
  NAT("evm", 42161, "arb-native", "ETH", "Ethereum", 18, "eth"),
  NAT("evm", 56, "bnb-native", "BNB", "BNB", 18, "bnb"),
  NAT("evm", 43114, "avax-native", "AVAX", "Avalanche", 18, "avax"),
  NAT("near", 397, "near-native", "NEAR", "NEAR", 24, "near"),
  NAT("cardano", 1815, "ada-native", "ADA", "Cardano", 6, "ada"),
  NAT("solana", 101, "sol-native", "SOL", "Solana", 9, "sol"),
];

const fromCmc = (cmc as TokenRecord[]).filter((t) => t.address);

export const TOKEN_CATALOG: TokenRecord[] = [...NATIVES, ...fromCmc];

export function tokensFor(vm: TokenVm, chainId?: number) {
  return TOKEN_CATALOG.filter((t) => t.vm === vm && (chainId == null || t.chainId === chainId));
}

export function cardanoByUnit(unit: string) {
  const compact = unit.replace(".", "").toLowerCase();
  return TOKEN_CATALOG.find((t) => {
    if (t.vm !== "cardano" || !t.address) return false;
    const a = t.address.toLowerCase();
    return compact === a || compact.startsWith(a) || a.startsWith(compact);
  });
}

export function solByMint(mint: string) {
  return TOKEN_CATALOG.find((t) => t.vm === "solana" && t.address === mint);
}
