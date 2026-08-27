import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cacheDropAccountRam } from "./defi/cache.ts";

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
  bitcoinAddress: string;
  bitcoinWallet: string;
  xrplAddress: string;
  xrplWallet: string;
  stellarAddress: string;
  stellarWallet: string;
  cosmosAddress: string;
  osmosisAddress: string;
  celestiaAddress: string;
  keplrWallet: string;
  starknetAddress: string;
  starknetWallet: string;
  setNear: (nearAccount: string) => void;
  setCardano: (cardanoAddress: string, cardanoWallet?: string, extras?: { addresses?: string[]; stake?: string }) => void;
  setSolana: (solanaAddress: string, solanaWallet?: string) => void;
  setTron: (tronAddress: string, tronWallet?: string) => void;
  setSui: (suiAddress: string, suiWallet?: string) => void;
  setTon: (tonAddress: string, tonWallet?: string) => void;
  setAptos: (aptosAddress: string, aptosWallet?: string) => void;
  setBitcoin: (bitcoinAddress: string, bitcoinWallet?: string) => void;
  setXrpl: (xrplAddress: string, xrplWallet?: string) => void;
  setStellar: (stellarAddress: string, stellarWallet?: string) => void;
  setKeplr: (addrs: { cosmos: string; osmosis: string; celestia: string }, keplrWallet?: string) => void;
  setStarknet: (starknetAddress: string, starknetWallet?: string) => void;
  disconnectNear: () => void;
  disconnectCardano: () => void;
  disconnectSolana: () => void;
  disconnectTron: () => void;
  disconnectSui: () => void;
  disconnectTon: () => void;
  disconnectAptos: () => void;
  disconnectBitcoin: () => void;
  disconnectXrpl: () => void;
  disconnectStellar: () => void;
  disconnectKeplr: () => void;
  disconnectStarknet: () => void;
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
      bitcoinAddress: "",
      bitcoinWallet: "",
      xrplAddress: "",
      xrplWallet: "",
      stellarAddress: "",
      stellarWallet: "",
      cosmosAddress: "",
      osmosisAddress: "",
      celestiaAddress: "",
      keplrWallet: "",
      starknetAddress: "",
      starknetWallet: "",
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
      setBitcoin: (bitcoinAddress, bitcoinWallet = "") => set({ bitcoinAddress, bitcoinWallet }),
      setXrpl: (xrplAddress, xrplWallet = "") => set({ xrplAddress, xrplWallet }),
      setStellar: (stellarAddress, stellarWallet = "") => set({ stellarAddress, stellarWallet }),
      setKeplr: (addrs, keplrWallet = "keplr") =>
        set({
          cosmosAddress: addrs.cosmos,
          osmosisAddress: addrs.osmosis,
          celestiaAddress: addrs.celestia,
          keplrWallet,
        }),
      setStarknet: (starknetAddress, starknetWallet = "") => set({ starknetAddress, starknetWallet }),
      disconnectNear: () => {
        cacheDropAccountRam();
        set({ nearAccount: "" });
      },
      disconnectCardano: () => {
        cacheDropAccountRam();
        set({ cardanoAddress: "", cardanoAddresses: [], cardanoStake: "", cardanoWallet: "" });
      },
      disconnectSolana: () => {
        cacheDropAccountRam();
        set({ solanaAddress: "", solanaWallet: "" });
      },
      disconnectTron: () => {
        cacheDropAccountRam();
        set({ tronAddress: "", tronWallet: "" });
      },
      disconnectSui: () => {
        cacheDropAccountRam();
        set({ suiAddress: "", suiWallet: "" });
      },
      disconnectTon: () => {
        cacheDropAccountRam();
        set({ tonAddress: "", tonWallet: "" });
      },
      disconnectAptos: () => {
        cacheDropAccountRam();
        set({ aptosAddress: "", aptosWallet: "" });
      },
      disconnectBitcoin: () => {
        cacheDropAccountRam();
        set({ bitcoinAddress: "", bitcoinWallet: "" });
      },
      disconnectXrpl: () => {
        cacheDropAccountRam();
        set({ xrplAddress: "", xrplWallet: "" });
      },
      disconnectStellar: () => {
        cacheDropAccountRam();
        set({ stellarAddress: "", stellarWallet: "" });
      },
      disconnectKeplr: () => {
        cacheDropAccountRam();
        set({ cosmosAddress: "", osmosisAddress: "", celestiaAddress: "", keplrWallet: "" });
      },
      disconnectStarknet: () => {
        cacheDropAccountRam();
        set({ starknetAddress: "", starknetWallet: "" });
      },
    }),
    {
      name: "ysk-mint.native-wallets",
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    },
  ),
);
