import { create } from "zustand";
import { persist } from "zustand/middleware";

export const BUY_GREEN = "#10b981";
export const SELL_RED = "#ef4444";

export type QuoteSide = "right" | "left";
export type QuotePriority = "stable-gas" | "gas-stable";

export type UserSettings = {
  liveDock: boolean;
  hideZero: boolean;
  autoOrient: boolean;
  quoteSide: QuoteSide;
  quotePriority: QuotePriority;
  buyColor: string;
  sellColor: string;
  disabledChains: number[];
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
};

type Store = UserSettings & {
  patch: (next: Partial<UserSettings>) => void;
  reset: () => void;
  setChainEnabled: (chainId: number, on: boolean) => void;
};

export const useUserSettings = create<Store>()(
  persist(
    (set, get) => ({
      ...SETTINGS_DEFAULTS,
      patch: (next) => set(next),
      reset: () => set({ ...SETTINGS_DEFAULTS }),
      setChainEnabled: (chainId, on) => {
        const cur = get().disabledChains;
        const has = cur.includes(chainId);
        if (on && has) set({ disabledChains: cur.filter((id) => id !== chainId) });
        if (!on && !has) set({ disabledChains: [...cur, chainId] });
      },
    }),
    { name: "ysk-mint.settings", version: 1 },
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
