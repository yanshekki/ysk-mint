import { type Address, type PublicClient } from "viem";
import { quoteUsd } from "./defi/quote.ts";
import { quoteSolMints, type Quote } from "./defiQuotes.ts";

export type Oracle = {
  usdc: number;
  venues: number;
};

export async function oracleTokenUsdc(
  client: PublicClient | undefined,
  chainId: number,
  token: Address | string | undefined,
  decimals: number,
  native?: boolean,
): Promise<Quote | null> {
  return quoteUsd({ evm: client }, chainId, token, decimals, native);
}

export { quoteSolMints };
