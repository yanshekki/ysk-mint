import catalog from "./ttCatalog.json";

export type TtSector = "dex" | "lending";
export type TtStatus = "wired" | "pending" | "skip";

export type TtProject = {
  id: string;
  name: string;
  sector: TtSector;
  family: string;
  status: TtStatus;
  chains: Array<number | string>;
  note: string;
};

const projects = catalog.projects as TtProject[];
const totals = catalog.ttTotals as { dex: number; lending: number };

function named(sector: TtSector, status?: TtStatus) {
  return projects.filter((p) => p.sector === sector && (status == null || p.status === status));
}

export function ttCoverage(sector: TtSector) {
  const total = totals[sector];
  const wired = named(sector, "wired").length;
  const skip = named(sector, "skip").length;
  const namedPending = named(sector, "pending").length;
  const unnamed = Math.max(0, total - named(sector).length);
  return {
    asOf: catalog.asOf as string,
    total,
    wired,
    pending: namedPending + unnamed,
    skip,
    unnamed,
  };
}

export function ttCoverageLine() {
  const d = ttCoverage("dex");
  const l = ttCoverage("lending");
  return { dex: d, lending: l };
}
