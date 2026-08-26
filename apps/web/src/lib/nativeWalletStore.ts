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
  tronAddress: string;
  tronWallet: string;
  suiAddress: string;
  suiWallet: string;
  tonAddress: string;
  tonWallet: string;
  aptosAddress: string;
  aptosWallet: string;
  setNear: (nearAccount: string) => void;
  setCardano: (cardanoAddress: string, cardanoWallet?: string, extras?: { addresses?: string[]; stake?: string }) => void;
  setSolana: (solanaAddress: string, solanaWallet?: string) => void;
  setTron: (tronAddress: string, tronWallet?: string) => void;
  setSui: (suiAddress: string, suiWallet?: string) => void;
  setTon: (tonAddress: string, tonWallet?: string) => void;
  setAptos: (aptosAddress: string, aptosWallet?: string) => void;
  disconnectNear: () => void;
  disconnectCardano: () => void;
  disconnectSolana: () => void;
  disconnectTron: () => void;
  disconnectSui: () => void;
  disconnectTon: () => void;
  disconnectAptos: () => void;
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
      tronAddress: "",
      tronWallet: "",
      suiAddress: "",
      suiWallet: "",
      tonAddress: "",
      tonWallet: "",
      aptosAddress: "",
      aptosWallet: "",
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
      setTron: (tronAddress, tronWallet = "") => set({ tronAddress, tronWallet }),
      setSui: (suiAddress, suiWallet = "") => set({ suiAddress, suiWallet }),
      setTon: (tonAddress, tonWallet = "") => set({ tonAddress, tonWallet }),
      setAptos: (aptosAddress, aptosWallet = "") => set({ aptosAddress, aptosWallet }),
      disconnectNear: () => set({ nearAccount: "" }),
      disconnectCardano: () => set({ cardanoAddress: "", cardanoAddresses: [], cardanoStake: "", cardanoWallet: "" }),
      disconnectSolana: () => set({ solanaAddress: "", solanaWallet: "" }),
      disconnectTron: () => set({ tronAddress: "", tronWallet: "" }),
      disconnectSui: () => set({ suiAddress: "", suiWallet: "" }),
      disconnectTon: () => set({ tonAddress: "", tonWallet: "" }),
      disconnectAptos: () => set({ aptosAddress: "", aptosWallet: "" }),
    }),
    {
      name: "ysk-mint.native-wallets",
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    },
  ),
);
