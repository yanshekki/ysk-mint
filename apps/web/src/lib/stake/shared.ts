import { formatUnits } from "viem";
import type { ProtocolLine } from "../defiPositions.ts";
import i18n from "../i18n.ts";

export type StakeStatus = "liquid" | "active" | "unstaking" | "claimable";

export type StakeLine = ProtocolLine & {
  status: StakeStatus;
  inWallet?: boolean;
  stakedSince?: string;
  unstakeNote?: string;
};

export const SOL_LST: Record<string, { symbol: string; name: string; icon: string }> = {
  msolzycxhdygdzu16g5qsh3i5k3z3kzk7ytfqcjm7so: { symbol: "mSOL", name: "Marinade mSOL", icon: "/tokens/sol.png" },
  j1toso1uck3rlmjorhttrvwy9hj7x8v9yyac6y7kgcpn: { symbol: "jitoSOL", name: "Jito SOL", icon: "/tokens/sol.png" },
  bso13r4tkie4kuml71lshtppl2euvfxqecgmod7hgak: { symbol: "bSOL", name: "Blaze bSOL", icon: "/tokens/sol.png" },
};

export function utc(ts: number) {
  if (!Number.isFinite(ts) || ts <= 0) return "";
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function fmtAmt(raw: bigint, decimals: number) {
  const n = Number(formatUnits(raw, decimals));
  if (!Number.isFinite(n)) return formatUnits(raw, decimals);
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function stakeSubtitle(l: StakeLine) {
  return [l.extra, l.stakedSince ? i18n.t("stake.since", { when: l.stakedSince }) : "", l.unstakeNote].filter(Boolean).join(" · ");
}

export function stakeBadge(l: StakeLine) {
  if (l.status === "claimable") return i18n.t("stake.claimable");
  if (l.status === "unstaking") return i18n.t("stake.unstaking");
  if (l.status === "active") return i18n.t("stake.active");
  return i18n.t("stake.liquid");
}
