import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GLOBAL_RPC_PROVIDERS, type RpcGlobalProvider } from "./rpcCatalog.ts";
import { DEFI_SCAN_KINDS, type DefiScanKind } from "./defiScan.ts";

export const BUY_GREEN = "#10b981";
export const SELL_RED = "#ef4444";

export type QuoteSide = "right" | "left";
export type QuotePriority = "stable-gas" | "gas-stable";
export type RpcStrategy = "preferred" | "random";

export type UserSettings = {
  liveDock: boolean;
  hideZero: boolean;
  autoOrient: boolean;
  quoteSide: QuoteSide;
  quotePriority: QuotePriority;
  buyColor: string;
  sellColor: string;
  disabledChains: number[];
  disabledDefi: DefiScanKind[];
  rpcByChain: Record<string, string>;
  rpcStrategy: RpcStrategy;
  rpcProvider: RpcGlobalProvider;
  rpcPickByChain: Record<string, string>;
  maxOutbound: number;
  maxOutboundPerHost: number;
};

export const SETTINGS_DEFAULTS: UserSettings = {
  liveDock: true,
  hideZero: true,
  autoOrient: true,
  quoteSide: "right",
  quotePriority: "stable-gas",
  buyColor: BUY_GREEN,
  sellColor: SELL_RED,
  disabledChains: [],
  disabledDefi: [],
  rpcByChain: {},
  rpcStrategy: "preferred",
  rpcProvider: "publicnode",
  rpcPickByChain: {},
  maxOutbound: 10,
  maxOutboundPerHost: 2,
};

function asRpcProvider(v: unknown): RpcGlobalProvider {
  return (GLOBAL_RPC_PROVIDERS as readonly string[]).includes(String(v)) ? (v as RpcGlobalProvider) : "publicnode";
}

type Store = UserSettings & {
  patch: (next: Partial<UserSettings>) => void;
  reset: () => void;
  setChainEnabled: (chainId: number, on: boolean) => void;
  setDefiEnabled: (kind: DefiScanKind, on: boolean) => void;
  setRpc: (chainId: number, url?: string) => void;
  setRpcPick: (chainId: number, pick?: string) => void;
};

const resetListeners = new Set<() => void>();

export function onUserSettingsReset(fn: () => void) {
  resetListeners.add(fn);
  return () => {
    resetListeners.delete(fn);
  };
}

export const useUserSettings = create<Store>()(
  persist(
    (set, get) => ({
      ...SETTINGS_DEFAULTS,
      patch: (next) => set(next),
      reset: () => {
        set({
          ...SETTINGS_DEFAULTS,
          disabledChains: [],
          disabledDefi: [],
          rpcByChain: {},
          rpcPickByChain: {},
        });
        for (const fn of resetListeners) fn();
      },
      setChainEnabled: (chainId, on) => {
        const cur = get().disabledChains;
        const has = cur.includes(chainId);
        if (on && has) set({ disabledChains: cur.filter((id) => id !== chainId) });
        if (!on && !has) set({ disabledChains: [...cur, chainId] });
      },
      setDefiEnabled: (kind, on) => {
        const cur = get().disabledDefi;
        const has = cur.includes(kind);
        if (on && has) set({ disabledDefi: cur.filter((k) => k !== kind) });
        if (!on && !has) set({ disabledDefi: [...cur, kind] });
      },
      setRpc: (chainId, url) => {
        const cur = { ...(get().rpcByChain ?? {}) };
        const key = String(chainId);
        if (!url) delete cur[key];
        else cur[key] = url;
        set({ rpcByChain: cur });
      },
      setRpcPick: (chainId, pick) => {
        const cur = { ...(get().rpcPickByChain ?? {}) };
        const key = String(chainId);
        if (!pick || pick === "inherit") delete cur[key];
        else cur[key] = pick;
        set({ rpcPickByChain: cur });
      },
    }),
    {
      name: "ysk-mint.settings",
      version: 3,
      migrate: (persisted, version) => {
        const s = persisted as Partial<UserSettings>;
        const base = {
          ...SETTINGS_DEFAULTS,
          ...s,
          rpcStrategy: s.rpcStrategy === "random" ? "random" : "preferred",
          rpcProvider: asRpcProvider(s.rpcProvider),
          rpcPickByChain: s.rpcPickByChain ?? {},
          disabledDefi: Array.isArray(s.disabledDefi)
            ? s.disabledDefi.filter((k): k is DefiScanKind => (DEFI_SCAN_KINDS as readonly string[]).includes(k))
            : [],
        };
        if (version < 2) {
          return { ...base, rpcStrategy: "preferred" as const, rpcPickByChain: {} };
        }
        return base;
      },
    },
  ),
);

export function isChainEnabled(chainId: number) {
  return !useUserSettings.getState().disabledChains.includes(chainId);
}

export function applyTradeColors(buy = useUserSettings.getState().buyColor, sell = useUserSettings.getState().sellColor) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--trade-buy", buy);
  document.documentElement.style.setProperty("--trade-sell", sell);
}

if (typeof document !== "undefined") {
  applyTradeColors();
  useUserSettings.subscribe((s) => applyTradeColors(s.buyColor, s.sellColor));
}
