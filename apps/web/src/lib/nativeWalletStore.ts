import { create } from "zustand";
import { persist } from "zustand/middleware";

type NativeState = {
  nearAccount: string;
  cardanoAddress: string;
  cardanoWallet: string;
  setNear: (nearAccount: string) => void;
  setCardano: (cardanoAddress: string, cardanoWallet?: string) => void;
  disconnectNear: () => void;
  disconnectCardano: () => void;
};

export const useNativeWallets = create<NativeState>()(
  persist(
    (set) => ({
      nearAccount: "",
      cardanoAddress: "",
      cardanoWallet: "",
      setNear: (nearAccount) => set({ nearAccount }),
      setCardano: (cardanoAddress, cardanoWallet = "") => set({ cardanoAddress, cardanoWallet }),
      disconnectNear: () => set({ nearAccount: "" }),
      disconnectCardano: () => set({ cardanoAddress: "", cardanoWallet: "" }),
    }),
    { name: "ysk-mint.native-wallets" },
  ),
);
