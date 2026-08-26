import { create } from "zustand";
import { persist } from "zustand/middleware";

type NativeState = {
  nearAccount: string;
  cardanoAddress: string;
  cardanoAddresses: string[];
  cardanoStake: string;
  cardanoWallet: string;
  cardanoSync: number;
  solanaAddress: string;
  solanaWallet: string;
  setNear: (nearAccount: string) => void;
  setCardano: (cardanoAddress: string, cardanoWallet?: string, extras?: { addresses?: string[]; stake?: string }) => void;
  setSolana: (solanaAddress: string, solanaWallet?: string) => void;
  disconnectNear: () => void;
  disconnectCardano: () => void;
  disconnectSolana: () => void;
};

export const useNativeWallets = create<NativeState>()(
  persist(
    (set) => ({
      nearAccount: "",
      cardanoAddress: "",
      cardanoAddresses: [],
      cardanoStake: "",
      cardanoWallet: "",
      cardanoSync: 0,
      solanaAddress: "",
      solanaWallet: "",
      setNear: (nearAccount) => set({ nearAccount }),
      setCardano: (cardanoAddress, cardanoWallet = "", extras = {}) =>
        set((s) => {
          const cardanoAddresses = extras.addresses ?? [cardanoAddress].filter(Boolean);
          const cardanoStake = extras.stake ?? "";
          const same =
            s.cardanoAddress === cardanoAddress &&
            s.cardanoWallet === cardanoWallet &&
            s.cardanoStake === cardanoStake &&
            s.cardanoAddresses.length === cardanoAddresses.length &&
            s.cardanoAddresses.every((a, i) => a === cardanoAddresses[i]);
          if (same) return s;
          return {
            cardanoAddress,
            cardanoWallet,
            cardanoAddresses,
            cardanoStake,
            cardanoSync: s.cardanoSync + 1,
          };
        }),
      setSolana: (solanaAddress, solanaWallet = "") => set({ solanaAddress, solanaWallet }),
      disconnectNear: () => set({ nearAccount: "" }),
      disconnectCardano: () => set({ cardanoAddress: "", cardanoAddresses: [], cardanoStake: "", cardanoWallet: "" }),
      disconnectSolana: () => set({ solanaAddress: "", solanaWallet: "" }),
    }),
    {
      name: "ysk-mint.native-wallets",
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    },
  ),
);
