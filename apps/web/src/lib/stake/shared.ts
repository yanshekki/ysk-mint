import { formatUnits } from "viem";
import type { ProtocolLine } from "../defiPositions.ts";
import i18n from "../i18n.ts";

export type StakeStatus = "liquid" | "active" | "unstaking" | "claimable";

export type StakeLine = ProtocolLine & {
  status: StakeStatus;
  inWallet?: boolean;
  stakedSince?: string;
  unstakeNote?: string;
  underlyingSymbol?: string;
  underlyingAmount?: string;
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

export function fmtNum(n: number) {
  if (!Number.isFinite(n)) return "";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

const LST_NATIVE: Record<string, { symbol: string; quoteKey: (chainId: number) => string }> = {
  steth: { symbol: "ETH", quoteKey: () => "1:native" },
  wsteth: { symbol: "ETH", quoteKey: () => "1:native" },
  reth: { symbol: "ETH", quoteKey: () => "1:native" },
  cbeth: { symbol: "ETH", quoteKey: () => "1:native" },
  weeth: { symbol: "ETH", quoteKey: () => "1:native" },
  eeth: { symbol: "ETH", quoteKey: () => "1:native" },
  ethx: { symbol: "ETH", quoteKey: () => "1:native" },
  oseth: { symbol: "ETH", quoteKey: () => "1:native" },
  rseth: { symbol: "ETH", quoteKey: () => "1:native" },
  ezeth: { symbol: "ETH", quoteKey: () => "1:native" },
  pufeth: { symbol: "ETH", quoteKey: () => "1:native" },
  sweth: { symbol: "ETH", quoteKey: () => "1:native" },
  ankreth: { symbol: "ETH", quoteKey: () => "1:native" },
  sfrxeth: { symbol: "ETH", quoteKey: () => "1:native" },
  meth: { symbol: "ETH", quoteKey: () => "1:native" },
  wbeth: { symbol: "ETH", quoteKey: () => "1:native" },
  khype: { symbol: "HYPE", quoteKey: () => "999:native" },
  kmhype: { symbol: "HYPE", quoteKey: () => "999:native" },
  vkhype: { symbol: "HYPE", quoteKey: () => "999:native" },
  behype: { symbol: "HYPE", quoteKey: () => "999:native" },
  sthype: { symbol: "HYPE", quoteKey: () => "999:native" },
  hihype: { symbol: "HYPE", quoteKey: () => "999:native" },
  stkaave: { symbol: "AAVE", quoteKey: () => "1:0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9" },
  savax: { symbol: "AVAX", quoteKey: () => "43114:native" },
  msol: { symbol: "SOL", quoteKey: () => "101:native" },
  jitosol: { symbol: "SOL", quoteKey: () => "101:native" },
  bsol: { symbol: "SOL", quoteKey: () => "101:native" },
  stnear: { symbol: "NEAR", quoteKey: () => "397:native" },
  linear: { symbol: "NEAR", quoteKey: () => "397:native" },
};

export function lstUnderlyingFromQuotes(
  chainId: number,
  symbol: string,
  amount: string,
  quotes: Map<string, { usdc: number }>,
  contract?: string,
): { underlyingSymbol: string; underlyingAmount: string } | undefined {
  const n = Number(String(amount).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return;
  const key = symbol.replace(/\s+/g, "").toLowerCase();
  const native = LST_NATIVE[key];
  if (!native) return;
  if (key === "steth") return { underlyingSymbol: "ETH", underlyingAmount: amount };
  const lstQ = contract ? quotes.get(`${chainId}:${contract.toLowerCase()}`) : undefined;
  const natQ = quotes.get(native.quoteKey(chainId)) ?? quotes.get(`${chainId}:native`);
  if (!lstQ || !natQ || !(natQ.usdc > 0)) return;
  const eq = (n * lstQ.usdc) / natQ.usdc;
  if (!Number.isFinite(eq) || eq <= 0) return;
  return { underlyingSymbol: native.symbol, underlyingAmount: fmtNum(eq) };
}

export function stakeSubtitle(l: StakeLine) {
  const under =
    l.underlyingAmount && l.underlyingSymbol && l.underlyingSymbol.toUpperCase() !== l.symbol.toUpperCase()
      ? i18n.t("stake.underlying", { amount: l.underlyingAmount, symbol: l.underlyingSymbol })
      : "";
  return [l.extra, under, l.stakedSince ? i18n.t("stake.since", { when: l.stakedSince }) : "", l.unstakeNote].filter(Boolean).join(" · ");
}

export function stakeBadge(l: StakeLine) {
  if (l.status === "claimable") return i18n.t("stake.claimable");
  if (l.status === "unstaking") return i18n.t("stake.unstaking");
  if (l.status === "active") return i18n.t("stake.active");
  return i18n.t("stake.liquid");
}
