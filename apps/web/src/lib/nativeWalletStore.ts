import { create } from "zustand";
import { persist } from "zustand/middleware";

type NativeState = {
  nearAccount: string;
  cardanoAddress: string;
  cardanoAddresses: string[];
  cardanoStake: string;
  cardanoWallet: string;
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
      solanaAddress: "",
      solanaWallet: "",
      setNear: (nearAccount) => set({ nearAccount }),
      setCardano: (cardanoAddress, cardanoWallet = "", extras = {}) =>
        set({
          cardanoAddress,
          cardanoWallet,
          cardanoAddresses: extras.addresses ?? [cardanoAddress].filter(Boolean),
          cardanoStake: extras.stake ?? "",
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
