import { create } from "zustand";
import { persist } from "zustand/middleware";

type NativeState = {
  nearAccount: string;
  cardanoAddress: string;
  cardanoWallet: string;
  solanaAddress: string;
  solanaWallet: string;
  setNear: (nearAccount: string) => void;
  setCardano: (cardanoAddress: string, cardanoWallet?: string) => void;
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
      cardanoWallet: "",
      solanaAddress: "",
      solanaWallet: "",
      setNear: (nearAccount) => set({ nearAccount }),
      setCardano: (cardanoAddress, cardanoWallet = "") => set({ cardanoAddress, cardanoWallet }),
      setSolana: (solanaAddress, solanaWallet = "") => set({ solanaAddress, solanaWallet }),
      disconnectNear: () => set({ nearAccount: "" }),
      disconnectCardano: () => set({ cardanoAddress: "", cardanoWallet: "" }),
      disconnectSolana: () => set({ solanaAddress: "", solanaWallet: "" }),
    }),
    {
      name: "ysk-mint.native-wallets",
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    },
  ),
);
