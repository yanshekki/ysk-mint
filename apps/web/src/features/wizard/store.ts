import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ChainKey, LaunchStep, LockMode, OwnershipAction, SupplyMode } from "@ysk-mint/sdk";

export type WizardDraft = {
  step: number;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  description: string;
  logoUri: string;
  website: string;
  supplyMode: number;
  ownershipAction: number;
  ownershipTarget: string;
  chains: number[];
  lpTokenAmount: string;
  lpNativeAmount: string;
  lockMode: number;
  lockDuration: number;
  tokenAddress?: `0x${string}`;
  lockId?: string;
  lpToken?: `0x${string}`;
  createTx?: `0x${string}`;
  lpTx?: `0x${string}`;
};

const defaults: WizardDraft = {
  step: LaunchStep.Wallet,
  name: "",
  symbol: "",
  decimals: 18,
  totalSupply: "1000000",
  description: "",
  logoUri: "",
  website: "",
  supplyMode: SupplyMode.Fixed,
  ownershipAction: OwnershipAction.Keep,
  ownershipTarget: "",
  chains: [ChainKey.BaseSepolia],
  lpTokenAmount: "400000",
  lpNativeAmount: "0.1",
  lockMode: LockMode.Timed,
  lockDuration: 30 * 24 * 60 * 60,
};

type Store = WizardDraft & {
  set: (patch: Partial<WizardDraft>) => void;
  reset: () => void;
};

export const useWizard = create<Store>()(
  persist(
    (set) => ({
      ...defaults,
      set: (patch) => set(patch),
      reset: () => set(defaults),
    }),
    { name: "ysk-mint.wizard" },
  ),
);
