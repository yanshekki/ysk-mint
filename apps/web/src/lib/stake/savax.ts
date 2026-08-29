import { formatUnits, type Address, type PublicClient } from "viem";
import { accountCache } from "../defi/cache.ts";
import { fmtAmt, utc, type StakeLine, type StakeStatus } from "./shared.ts";

const erc20Bal = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export const SAVAX = "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE" as Address;
export const savaxAbi = [
  ...erc20Bal,
  { type: "function", name: "getPooledAvaxByShares", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getUnlockRequestCount", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "getPaginatedUnlockRequests",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "startedAt", type: "uint256" },
          { name: "shareAmount", type: "uint256" },
        ],
      },
      { type: "uint256[]" },
    ],
  },
  { type: "function", name: "cooldownPeriod", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "redeemPeriod", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
export async function readSavaxUnlocks(client: PublicClient, user: Address, avaxUsd?: number | null): Promise<StakeLine[]> {
  return accountCache("pos.stake", 43114, user, "savax", () => readSavaxUnlocksWork(client, user, avaxUsd));
}

async function readSavaxUnlocksWork(client: PublicClient, user: Address, avaxUsd?: number | null): Promise<StakeLine[]> {
  try {
    const count = await client.readContract({ address: SAVAX, abi: savaxAbi, functionName: "getUnlockRequestCount", args: [user] });
    if (count === 0n) return [];
    const n = Number(count);
    const [reqs, avaxAmts] = await client.readContract({
      address: SAVAX,
      abi: savaxAbi,
      functionName: "getPaginatedUnlockRequests",
      args: [user, 0n, BigInt(n)],
    });
    const cool = Number(await client.readContract({ address: SAVAX, abi: savaxAbi, functionName: "cooldownPeriod" }));
    const redeem = Number(await client.readContract({ address: SAVAX, abi: savaxAbi, functionName: "redeemPeriod" }));
    const now = Date.now() / 1000;
    const out: StakeLine[] = [];
    reqs.forEach((r, i) => {
      const start = Number(r.startedAt);
      const shares = r.shareAmount;
      if (shares === 0n) return;
      const coolEnd = start + cool;
      const redeemEnd = coolEnd + redeem;
      let status: StakeStatus = "unstaking";
      let note = `冷卻至 ${utc(coolEnd)}，其後至 ${utc(redeemEnd)} 可領`;
      if (now >= coolEnd && now <= redeemEnd) {
        status = "claimable";
        note = `可領，窗口至 ${utc(redeemEnd)}`;
      } else if (now > redeemEnd) {
        note = "領取窗口已過，須重新申請";
      }
      const avaxRaw = avaxAmts[i] ?? 0n;
      const avaxN = Number(formatUnits(avaxRaw || shares, 18));
      out.push({
        id: `savax-unlock-${i}-${start}`,
        chainId: 43114,
        chain: "AVAX",
        symbol: "sAVAX",
        name: "BENQI 解押",
        icon: "/tokens/avax.png",
        amount: fmtAmt(shares, 18),
        raw: shares,
        contract: SAVAX,
        side: "stake",
        extra: `#${i}`,
        quote: avaxUsd ? { usdc: avaxUsd, source: "v2" } : null,
        valueUsdc: avaxUsd && Number.isFinite(avaxN) ? avaxN * avaxUsd : null,
        status,
        inWallet: false,
        stakedSince: utc(start),
        unstakeNote: note,
      });
    });
    return out;
  } catch {
    return [];
  }
}
