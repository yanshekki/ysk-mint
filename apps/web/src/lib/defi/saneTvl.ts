/** If a USD stable reserve exists, drop indexer/API TVL that is many times larger than 2× that reserve. */
export function saneUsdDepth(reported: number, stableUsd: number): number {
  const r = Number.isFinite(reported) && reported > 0 ? reported : 0;
  const s = Number.isFinite(stableUsd) && stableUsd > 0 ? stableUsd : 0;
  if (!s) return r;
  if (r > 8 * s) return s * 2;
  return r || s * 2;
}
