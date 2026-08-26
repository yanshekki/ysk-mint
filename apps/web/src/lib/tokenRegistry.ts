import { featuredChains } from "@ysk-mint/config";
import cmc from "./cmcCatalog.json";

export type TokenVm = "evm" | "near" | "cardano" | "solana" | "tron" | "sui" | "ton" | "aptos" | "hypercore";

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
  NAT("evm", 137, "pol-native", "POL", "Polygon", 18, "pol"),
  NAT("evm", 10, "op-native", "ETH", "Ethereum", 18, "eth"),
  NAT("evm", 250, "ftm-native", "FTM", "Fantom", 18, "ftm"),
  NAT("evm", 5000, "mnt-native", "MNT", "Mantle", 18, "mnt"),
  NAT("evm", 480, "world-native", "ETH", "Ethereum", 18, "eth"),
  NAT("evm", 999, "hype-native", "HYPE", "HYPE", 18, "hype"),
  NAT("near", 397, "near-native", "NEAR", "NEAR", 24, "near"),
  NAT("cardano", 1815, "ada-native", "ADA", "Cardano", 6, "ada"),
  NAT("solana", 101, "sol-native", "SOL", "Solana", 9, "sol"),
  NAT("tron", 728126428, "trx-native", "TRX", "TRON", 6, "trx"),
  NAT("sui", 784, "sui-native", "SUI", "Sui", 9, "sui"),
  NAT("ton", 607, "ton-native", "TON", "Toncoin", 9, "ton"),
  NAT("aptos", 637, "apt-native", "APT", "Aptos", 8, "apt"),
  NAT("hypercore", 998, "hypercore-native", "HYPE", "HYPE", 8, "hype"),
];

function nativeDecimals(vm: string, symbol: string) {
  if (symbol === "USD") return 6;
  if (vm === "near") return 24;
  if (vm === "cardano" || vm === "tron") return 6;
  if (vm === "solana" || vm === "sui" || vm === "ton") return 9;
  if (vm === "aptos" || vm === "hypercore") return 8;
  return 18;
}

function nativeIcon(symbol: string, chainId: number) {
  const s = symbol.toLowerCase();
  if (["eth", "bnb", "avax", "pol", "ftm", "mnt", "hype", "ada", "near", "sol", "trx", "sui", "ton", "apt", "op"].includes(s)) return s === "eth" ? "eth" : s;
  if (chainId === 10) return "op";
  if (chainId === 480) return "wld";
  return "eth";
}

const HAVE_NATIVE = new Set(NATIVES.map((t) => t.chainId));
const AUTO_NATIVES: TokenRecord[] = featuredChains()
  .filter((c) => !c.testnet && !HAVE_NATIVE.has(c.chainId))
  .map((c) =>
    NAT(
      c.vm as TokenVm,
      c.chainId,
      `${c.key}-${c.chainId}-native`,
      c.nativeSymbol,
      c.name,
      nativeDecimals(c.vm, c.nativeSymbol),
      nativeIcon(c.nativeSymbol, c.chainId),
    ),
  );

const EXTRA: TokenRecord[] = [
  { id: "pol-usdc", vm: "evm", chainId: 137, symbol: "USDC", name: "USD Coin", decimals: 6, address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", icon: I("usdc") },
  { id: "pol-usdt", vm: "evm", chainId: 137, symbol: "USDT", name: "Tether", decimals: 6, address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", icon: I("usdt") },
  { id: "op-usdc", vm: "evm", chainId: 10, symbol: "USDC", name: "USD Coin", decimals: 6, address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", icon: I("usdc") },
  { id: "op-usdt", vm: "evm", chainId: 10, symbol: "USDT", name: "Tether", decimals: 6, address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", icon: I("usdt") },
  { id: "op-op", vm: "evm", chainId: 10, symbol: "OP", name: "Optimism", decimals: 18, address: "0x4200000000000000000000000000000000000042", icon: I("op") },
  { id: "ftm-usdc", vm: "evm", chainId: 250, symbol: "USDC", name: "USD Coin", decimals: 6, address: "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75", icon: I("usdc") },
  { id: "mnt-usdt", vm: "evm", chainId: 5000, symbol: "USDT", name: "Tether", decimals: 6, address: "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE", icon: I("usdt") },
  { id: "world-usdc", vm: "evm", chainId: 480, symbol: "USDC", name: "USD Coin", decimals: 6, address: "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1", icon: I("usdc") },
  { id: "world-wld", vm: "evm", chainId: 480, symbol: "WLD", name: "Worldcoin", decimals: 18, address: "0x2cFc85d8e48F8EAB294be644d9E25C3030863003", icon: I("wld") },
  { id: "trx-usdt", vm: "tron", chainId: 728126428, symbol: "USDT", name: "Tether", decimals: 6, address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", icon: I("usdt") },
  { id: "sui-usdc", vm: "sui", chainId: 784, symbol: "USDC", name: "USD Coin", decimals: 6, address: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC", icon: I("usdc") },
  { id: "ton-usdt", vm: "ton", chainId: 607, symbol: "USDT", name: "Tether", decimals: 6, address: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs", icon: I("usdt") },
  { id: "apt-usdc", vm: "aptos", chainId: 637, symbol: "USDC", name: "USD Coin", decimals: 6, address: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b", icon: I("usdc") },
];

const fromCmc = (cmc as TokenRecord[]).filter((t) => t.address);

export const TOKEN_CATALOG: TokenRecord[] = [...NATIVES, ...AUTO_NATIVES, ...EXTRA, ...fromCmc];

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
