import { formatUnits, type Address, type PublicClient } from "viem";
import { accountCache } from "../defi/cache.ts";
import { type Quote } from "../defiQuotes.ts";
import type { AaveCard, ProtocolLine } from "../defiPositions.ts";
import { fmtAmt } from "./shared.ts";
import { SAVAX } from "./savax.ts";
import i18n from "../i18n.ts";

const erc20Bal = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
const BENQI_LP = "0x784DA19e61cf348a8c54547531795ECfee2AfFd1" as Address;
const qiSnapAbi = [
  ...erc20Bal,
  {
    type: "function",
    name: "getAccountSnapshot",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
  },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

const chefAbi = [
  { type: "function", name: "poolLength", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "userInfo",
    stateMutability: "view",
    inputs: [{ type: "uint256" }, { type: "address" }],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },
] as const;

const BENQI_QI: Array<{ token: Address; symbol: string; underlying: string; dec: number }> = [
  { token: "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c", symbol: "AVAX", underlying: "avax", dec: 18 },
  { token: "0xF362feA9659cf036792c9cb02f8ff8198E21B4cB", symbol: "sAVAX", underlying: "savax", dec: 18 },
  { token: "0xBEb5d47A3f720Ec0a390d04b4d41ED7d9688bC7F", symbol: "USDC", underlying: "usd", dec: 6 },
  { token: "0xc9e5999b8e75C3fEB117F6f73E664b9f3C8ca65C", symbol: "USDT.e", underlying: "usd", dec: 6 },
  { token: "0xB715808a78F6041E46d61Cb123C9B4A27056AE9C", symbol: "USDC", underlying: "usd", dec: 6 },
  { token: "0xd8fcDa6ec4Bdc547C0827B8804e89aCd817d56EF", symbol: "USDT", underlying: "usd", dec: 6 },
  { token: "0x835866d37AFB8CB8F8334dCCdaf66cf01832Ff5D", symbol: "DAI", underlying: "usd", dec: 18 },
];
export async function readBenqiMarkets(client: PublicClient, user: Address, quotes: Map<string, Quote>): Promise<AaveCard | null> {
  return accountCache("pos.lend", 43114, user, "benqi", () => readBenqiMarketsWork(client, user, quotes));
}

async function readBenqiMarketsWork(client: PublicClient, user: Address, quotes: Map<string, Quote>): Promise<AaveCard | null> {
  const avaxUsd = quotes.get("43114:native")?.usdc;
  const savaxQ = quotes.get(`43114:${SAVAX.toLowerCase()}`);
  const lines: ProtocolLine[] = [];
  const tokens = new Set<string>();
  await Promise.all(
    BENQI_QI.map(async (m) => {
      try {
        const snap = await client.readContract({ address: m.token, abi: qiSnapAbi, functionName: "getAccountSnapshot", args: [user] });
        const qiBal = snap[1];
        const borrow = snap[2];
        const rate = snap[3];
        tokens.add(m.token.toLowerCase());
        const und = qiBal === 0n ? 0n : (qiBal * rate) / 10n ** 18n;
        const push = (raw: bigint, side: "supply" | "borrow") => {
          if (raw === 0n) return;
          const n = Number(formatUnits(raw, m.dec));
          const q =
            m.underlying === "usd"
              ? { usdc: 1, source: "stable" as const }
              : m.underlying === "savax"
                ? savaxQ
                : avaxUsd
                  ? { usdc: avaxUsd, source: "v2" as const }
                  : null;
          lines.push({
            id: `benqi-${side}-${m.token}`,
            chainId: 43114,
            chain: "AVAX",
            symbol: m.symbol,
            name: m.symbol,
            icon: "/tokens/avax.png",
            amount: fmtAmt(raw, m.dec),
            raw,
            contract: m.token,
            side,
            quote: q ?? null,
            valueUsdc: q && Number.isFinite(n) ? n * q.usdc : null,
          });
        };
        push(und, "supply");
        push(borrow, "borrow");
      } catch {
        /* market miss */
      }
    }),
  );
  try {
    const len = await client.readContract({ address: BENQI_LP, abi: chefAbi, functionName: "poolLength" });
    const n = Math.min(Number(len), 16);
    for (let i = 0; i < n; i++) {
      const info = await client.readContract({ address: BENQI_LP, abi: chefAbi, functionName: "userInfo", args: [BigInt(i), user] });
      const amt = info[0];
      if (amt === 0n) continue;
      lines.push({
        id: `benqi-lp-${i}`,
        chainId: 43114,
        chain: "AVAX",
        symbol: "LP",
        name: `BENQI LP #${i}`,
        icon: "/tokens/avax.png",
        amount: fmtAmt(amt, 18),
        raw: amt,
        contract: BENQI_LP,
        side: "lp",
        extra: i18n.t("stake.benqiLp"),
      });
    }
  } catch {
    /* no chef */
  }
  if (!lines.length) return null;
  return { chainId: 43114, chain: "AVAX", health: "—", lines, aTokens: tokens };
}
