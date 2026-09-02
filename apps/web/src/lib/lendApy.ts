const YEAR = 365.25 * 24 * 3600;
const RAY = 1e27;

export function rayApy(rate: bigint): number | null {
  const apr = Number(rate) / RAY;
  if (!Number.isFinite(apr) || apr < 0) return null;
  if (apr === 0) return 0;
  if (apr > 2) return null;
  const apy = (1 + apr / YEAR) ** YEAR - 1;
  if (!Number.isFinite(apy) || apy < 0 || apy > 5) return apr * 100;
  return apy * 100;
}

export function perSecondApy(rate: bigint): number | null {
  const r = Number(rate) / 1e18;
  if (!Number.isFinite(r) || r < 0) return null;
  const apy = (1 + r) ** YEAR - 1;
  if (!Number.isFinite(apy) || apy < 0 || apy > 10) {
    const apr = r * YEAR;
    return Number.isFinite(apr) && apr >= 0 && apr <= 10 ? apr * 100 : null;
  }
  return apy * 100;
}

export function perBlockApy(rate: bigint, blocksYear: number): number | null {
  const r = Number(rate) / 1e18;
  if (!Number.isFinite(r) || r < 0) return null;
  if (r === 0) return 0;
  const apy = (1 + r) ** blocksYear - 1;
  if (!Number.isFinite(apy) || apy < 0 || apy > 10) {
    const apr = r * blocksYear;
    return Number.isFinite(apr) && apr >= 0 && apr <= 10 ? apr * 100 : null;
  }
  return apy * 100;
}

export function blocksYear(chainId: number) {
  if (chainId === 56) return 10_512_000;
  if (chainId === 43114) return 15_768_000;
  if (chainId === 137) return 15_768_000;
  return 2_628_000;
}

export function cTokenApy(
  chainId: number,
  supplyTs?: bigint | null,
  borrowTs?: bigint | null,
  supplyBlk?: bigint | null,
  borrowBlk?: bigint | null,
): { supply: number | null; borrow: number | null } {
  const yr = blocksYear(chainId);
  return {
    supply: supplyTs != null ? perSecondApy(supplyTs) : supplyBlk != null ? perBlockApy(supplyBlk, yr) : null,
    borrow: borrowTs != null ? perSecondApy(borrowTs) : borrowBlk != null ? perBlockApy(borrowBlk, yr) : null,
  };
}
