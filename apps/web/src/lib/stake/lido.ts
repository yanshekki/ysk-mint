import { formatUnits, type Address, type PublicClient } from "viem";
import { accountCache } from "../defi/cache.ts";
import { fmtAmt, utc, type StakeLine, type StakeStatus } from "./shared.ts";
import i18n from "../i18n.ts";

const LIDO_WQ = "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1" as Address;

const lidoWqAbi = [
  { type: "function", name: "getWithdrawalRequests", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256[]" }] },
  {
    type: "function",
    name: "getWithdrawalStatus",
    stateMutability: "view",
    inputs: [{ type: "uint256[]" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "amountOfStETH", type: "uint256" },
          { name: "amountOfShares", type: "uint256" },
          { name: "owner", type: "address" },
          { name: "timestamp", type: "uint256" },
          { name: "isFinalized", type: "bool" },
          { name: "isClaimed", type: "bool" },
        ],
      },
    ],
  },
] as const;
export async function readLidoQueue(client: PublicClient, user: Address, ethUsd?: number | null): Promise<StakeLine[]> {
  return accountCache("pos.stake", 1, user, "lido-wq", () => readLidoQueueWork(client, user, ethUsd));
}

async function readLidoQueueWork(client: PublicClient, user: Address, ethUsd?: number | null): Promise<StakeLine[]> {
  try {
    const ids = await client.readContract({ address: LIDO_WQ, abi: lidoWqAbi, functionName: "getWithdrawalRequests", args: [user] });
    if (!ids.length) return [];
    const statuses = await client.readContract({ address: LIDO_WQ, abi: lidoWqAbi, functionName: "getWithdrawalStatus", args: [ids] });
    const out: StakeLine[] = [];
    statuses.forEach((s, i) => {
      if (s.isClaimed) return;
      const n = Number(formatUnits(s.amountOfStETH, 18));
      const ts = Number(s.timestamp);
      const status: StakeStatus = s.isFinalized ? "claimable" : "unstaking";
      out.push({
        id: `lido-q-${ids[i].toString()}`,
        chainId: 1,
        chain: "ETH",
        symbol: "stETH",
        name: "Lido 提款隊列",
        icon: "/tokens/eth.png",
        amount: fmtAmt(s.amountOfStETH, 18),
        raw: s.amountOfStETH,
        contract: LIDO_WQ,
        side: "stake",
        extra: `#${ids[i].toString()}`,
        quote: ethUsd ? { usdc: ethUsd, source: "v3" } : null,
        valueUsdc: ethUsd && Number.isFinite(n) ? n * ethUsd : null,
        status,
        inWallet: false,
        stakedSince: ts ? utc(ts) : undefined,
        unstakeNote: s.isFinalized ? i18n.t("stake.lidoClaim") : i18n.t("stake.lidoQueue"),
      });
    });
    return out;
  } catch {
    return [];
  }
}
