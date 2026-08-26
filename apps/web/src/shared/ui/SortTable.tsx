import { useCallback, useMemo, useState, type ReactNode } from "react";

export type SortDir = "asc" | "desc";

function empty(v: number | string | null | undefined) {
  return v == null || v === "" || (typeof v === "number" && !Number.isFinite(v));
}

function cmp(a: number | string | null | undefined, b: number | string | null | undefined, dir: SortDir) {
  const aMiss = empty(a);
  const bMiss = empty(b);
  if (aMiss && bMiss) return 0;
  if (aMiss) return 1;
  if (bMiss) return -1;
  let d: number;
  if (typeof a === "number" && typeof b === "number") d = a - b;
  else d = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  return dir === "desc" ? -d : d;
}

export function useSort<T>(
  rows: T[],
  defaultKey: string,
  get: (row: T, key: string) => number | string | null | undefined,
  defaultDir: SortDir = "desc",
) {
  const [key, setKey] = useState(defaultKey);
  const [dir, setDir] = useState<SortDir>(defaultDir);
  const sorted = useMemo(() => {
    const list = rows.slice();
    list.sort((a, b) => {
      const d = cmp(get(a, key), get(b, key), dir);
      if (d !== 0) return d;
      return cmp(get(a, "name"), get(b, "name"), "asc");
    });
    return list;
  }, [dir, get, key, rows]);
  const toggle = useCallback(
    (next: string) => {
      if (next === key) setDir((d) => (d === "desc" ? "asc" : "desc"));
      else {
        setKey(next);
        setDir("desc");
      }
    },
    [key],
  );
  return { sorted, key, dir, toggle };
}

export function SortHead({
  id,
  label,
  active,
  dir,
  onToggle,
  align = "right",
}: {
  id: string;
  label: ReactNode;
  active: boolean;
  dir: SortDir;
  onToggle: (id: string) => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      className={`me-sort${active ? " me-sort-on" : ""}${align === "left" ? " me-sort-left" : ""}`}
      aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : "none"}
      onClick={() => onToggle(id)}
    >
      {label}
      <i>{active ? (dir === "desc" ? "▼" : "▲") : "↕"}</i>
    </button>
  );
}
