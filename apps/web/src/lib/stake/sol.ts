import { formatUnits } from "viem";
import { accountCache } from "../defi/cache.ts";
import { rpcJsonRpc } from "../rpcPool.ts";
import { fmtAmt, type StakeLine, type StakeStatus } from "./shared.ts";

const SOL_STAKE = "Stake11111111111111111111111111111111111111";
async function solRpc(method: string, params: unknown[]) {
  try {
    return await rpcJsonRpc(101, method, params);
  } catch {
    return null;
  }
}

export async function readSolStake(pubkey: string, solUsd?: number | null): Promise<StakeLine[]> {
  if (!pubkey) return [];
  return accountCache("pos.stake", 101, pubkey, "sol", () => readSolStakeWork(pubkey, solUsd));
}

async function readSolStakeWork(pubkey: string, solUsd?: number | null): Promise<StakeLine[]> {
  const parsed = await solRpc("getProgramAccounts", [
    SOL_STAKE,
    { encoding: "jsonParsed", filters: [{ memcmp: { offset: 12, bytes: pubkey } }] },
  ]);
  const list = Array.isArray(parsed) ? parsed : [];
  const epochInfo = (await solRpc("getEpochInfo", [])) as { epoch?: number; slotIndex?: number; slotsInEpoch?: number } | null;
  const epoch = epochInfo?.epoch ?? 0;
  const remainSlots = (epochInfo?.slotsInEpoch ?? 0) - (epochInfo?.slotIndex ?? 0);
  const remainHrs = remainSlots > 0 ? Math.round((remainSlots * 0.4) / 3600) : 0;
  const out: StakeLine[] = [];
  for (const item of list) {
    const pk = (item as { pubkey?: string }).pubkey || "";
    const info = (item as { account?: { data?: { parsed?: { info?: Record<string, unknown> } } } }).account?.data?.parsed?.info;
    const stake = info?.stake as { delegation?: { stake?: string; activationEpoch?: string; deactivationEpoch?: string; voter?: string } } | undefined;
    const del = stake?.delegation;
    const lamports = BigInt(del?.stake || (item as { account?: { lamports?: number } }).account?.lamports || 0);
    if (lamports === 0n) continue;
    const act = Number(del?.activationEpoch ?? 0);
    const deact = Number(del?.deactivationEpoch ?? 0);
    const deactivating = Number.isFinite(deact) && deact < 1e18;
    const n = Number(formatUnits(lamports, 9));
    let status: StakeStatus = "active";
    let unstakeNote = `解除委託後下個 epoch 生效（本 epoch ${epoch}${remainHrs ? `，約 ${remainHrs} 小時結束` : ""}）`;
    if (deactivating) {
      status = deact <= epoch ? "claimable" : "unstaking";
      unstakeNote = deact <= epoch ? "可領" : `解押中，deactivation epoch ${deact}`;
    }
    out.push({
      id: `sol-stk-${pk}`,
      chainId: 101,
      chain: "SOL",
      symbol: "SOL",
      name: "Stake account",
      icon: "/tokens/sol.png",
      amount: fmtAmt(lamports, 9),
      raw: lamports,
      contract: pk,
      side: "stake",
      extra: del?.voter ? String(del.voter).slice(0, 8) : pk.slice(0, 8),
      quote: solUsd ? { usdc: solUsd, source: "jup" } : null,
      valueUsdc: solUsd && Number.isFinite(n) ? n * solUsd : null,
      status,
      inWallet: false,
      stakedSince: act ? `epoch ${act}` : undefined,
      unstakeNote,
    });
  }
  return out;
}

