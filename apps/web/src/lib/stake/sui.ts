import { accountCache } from "../defi/cache.ts";
import { rpcJsonRpc } from "../rpcPool.ts";
import { fmtAmt, type StakeLine } from "./shared.ts";

type SuiStake = {
  principal?: string;
  estimatedReward?: string;
  status?: string | { Active?: { estimatedReward?: string }; Pending?: unknown; Unstaked?: unknown };
};

type SuiStakeSet = {
  validatorAddress?: string;
  stakes?: SuiStake[];
};

function principalOf(s: SuiStake) {
  try {
    return BigInt(s.principal || "0");
  } catch {
    return 0n;
  }
}

function rewardOf(s: SuiStake) {
  const nested =
    s.status && typeof s.status === "object" && s.status.Active ? s.status.Active.estimatedReward : undefined;
  try {
    return BigInt(s.estimatedReward || nested || "0");
  } catch {
    return 0n;
  }
}

function statusOf(s: SuiStake): StakeLine["status"] {
  if (s.status === "Pending" || (s.status && typeof s.status === "object" && "Pending" in s.status)) return "unstaking";
  if (s.status && typeof s.status === "object" && "Unstaked" in s.status) return "claimable";
  return "active";
}

export async function readSuiStake(addr: string): Promise<StakeLine[]> {
  if (!addr) return [];
  return accountCache("pos.stake", 784, addr, "sui", () => readSuiStakeWork(addr));
}

async function readSuiStakeWork(addr: string): Promise<StakeLine[]> {
  const sets = await rpcJsonRpc<SuiStakeSet[]>(784, "suix_getStakes", [addr]);
  const out: StakeLine[] = [];
  for (const set of sets ?? []) {
    const validator = set.validatorAddress || "";
    for (const s of set.stakes ?? []) {
      const raw = principalOf(s) + rewardOf(s);
      if (raw <= 0n) continue;
      out.push({
        id: `sui-stk-${validator}-${s.principal ?? out.length}`,
        chainId: 784,
        chain: "SUI",
        symbol: "SUI",
        name: "Staked SUI",
        icon: "/tokens/sui.png",
        amount: fmtAmt(raw, 9),
        raw,
        contract: validator || undefined,
        side: "stake",
        extra: validator ? validator.slice(0, 10) : undefined,
        quote: null,
        valueUsdc: null,
        status: statusOf(s),
        inWallet: false,
      });
    }
  }
  return out;
}
