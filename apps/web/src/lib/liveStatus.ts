import { create } from "zustand";

export type LiveKind = "markets" | "holdings" | "quote" | "lp" | "trades" | "defi";

export type LivePhase = "wait" | "run" | "fail";

export type LiveJob = {
  id: string;
  chainId: number;
  kind: LiveKind;
  phase: LivePhase;
  at: number;
};

type Store = {
  jobs: LiveJob[];
  start: (id: string, chainId: number, kind: LiveKind, phase?: Exclude<LivePhase, "fail">) => void;
  run: (id: string) => void;
  finish: (id: string, ok?: boolean) => void;
  clear: (prefix?: string) => void;
};

export const useLiveStatus = create<Store>((set, get) => ({
  jobs: [],
  start: (id, chainId, kind, phase = "run") => {
    const cur = get().jobs.find((j) => j.id === id);
    if (cur && cur.chainId === chainId && cur.kind === kind && cur.phase === phase) return;
    set((s) => ({
      jobs: [...s.jobs.filter((j) => j.id !== id), { id, chainId, kind, phase, at: Date.now() }],
    }));
  },
  run: (id) => {
    const cur = get().jobs.find((j) => j.id === id);
    if (!cur || cur.phase === "run") return;
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, phase: "run" as const, at: Date.now() } : j)),
    }));
  },
  finish: (id, ok = true) => {
    const cur = get().jobs.find((j) => j.id === id);
    if (!cur) return;
    if (ok) {
      set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
      return;
    }
    if (cur.phase === "fail") return;
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, phase: "fail" as const, at: Date.now() } : j)),
    }));
    window.setTimeout(() => {
      set((s) => {
        const row = s.jobs.find((j) => j.id === id);
        if (!row || row.phase !== "fail") return s;
        return { jobs: s.jobs.filter((j) => j.id !== id) };
      });
    }, 2000);
  },
  clear: (prefix) => {
    set((s) => {
      const next = prefix ? s.jobs.filter((j) => !j.id.startsWith(prefix)) : [];
      if (next.length === s.jobs.length) return s;
      return { jobs: next };
    });
  },
}));

export function liveBusy(chainId?: number, kinds?: LiveKind[]) {
  return useLiveStatus.getState().jobs.some((j) => {
    if (j.phase === "fail") return false;
    if (chainId != null && j.chainId !== chainId) return false;
    if (kinds && !kinds.includes(j.kind)) return false;
    return true;
  });
}

export function syncLiveFlag(id: string, chainId: number, kind: LiveKind, on: boolean) {
  const api = useLiveStatus.getState();
  if (on) api.start(id, chainId, kind, "run");
  else api.finish(id, true);
}

export async function trackLive<T>(id: string, chainId: number, kind: LiveKind, fn: () => Promise<T>): Promise<T> {
  const api = useLiveStatus.getState();
  api.start(id, chainId, kind, "run");
  try {
    const value = await fn();
    useLiveStatus.getState().finish(id, true);
    return value;
  } catch (err) {
    useLiveStatus.getState().finish(id, false);
    throw err;
  }
}
