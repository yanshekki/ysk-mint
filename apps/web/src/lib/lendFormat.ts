import { fmtCompact } from "./defiQuotes.ts";

export function fmtApy(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n === 0) return "0%";
  if (Math.abs(n) < 0.01) return "<0.01%";
  if (Math.abs(n) < 10) return `${n.toFixed(2)}%`;
  return `${n.toFixed(1)}%`;
}

export function fmtApyRange(min: number | null | undefined, max: number | null | undefined) {
  if (min == null && max == null) return "—";
  if (min == null) return fmtApy(max);
  if (max == null) return fmtApy(min);
  if (Math.abs(max - min) < 0.005) return fmtApy(min);
  return `${fmtApy(min)}–${fmtApy(max)}`;
}

export function fmtUsd(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 10_000 && abs < 1e6) return `$${(n / 1000).toFixed(1)}K`;
  return `$${fmtCompact(n)}`;
}

export function utilOf(r: { supplyUsd: number | null; borrowUsd: number | null }) {
  if (r.supplyUsd == null || r.supplyUsd <= 0 || r.borrowUsd == null || r.borrowUsd < 0) return null;
  const pct = (r.borrowUsd / r.supplyUsd) * 100;
  if (!Number.isFinite(pct) || pct < 0) return null;
  return Math.min(100, pct);
}

export function shortAddr(a: string) {
  if (!a || a === "native") return a === "native" ? "native" : a || "—";
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function sameLendToken(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}
