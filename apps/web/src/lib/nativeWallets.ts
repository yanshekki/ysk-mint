import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NearConnector } from "@hot-labs/near-connect";
import { isCardanoAddress, isNearAccountId } from "@ysk-mint/sdk";
import { enableCardano, listCardanoWallets, type CardanoWalletInfo } from "./cardanoCip30.ts";

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

let nearConnector: NearConnector | null = null;
let nearConnectorPending: Promise<NearConnector> | null = null;
let nearListenersBound = false;

/** Official NEAR connector (docs.near.org Wallet Login, 2026-08). Not MyNearWallet /login. Loaded on connect, not at boot. */
export async function getNearConnector(): Promise<NearConnector> {
  if (nearConnector) return nearConnector;
  if (!nearConnectorPending) {
    nearConnectorPending = import("@hot-labs/near-connect").then((mod) => {
      const NearConnector = mod.NearConnector;
      nearConnector = new NearConnector({
        network: "mainnet",
        autoConnect: true,
        features: {
          signAndSendTransaction: true,
          signInWithoutAddKey: true,
        },
      });
      if (!nearListenersBound) {
        nearListenersBound = true;
        nearConnector.on("wallet:signIn", ({ accounts, success }) => {
          const id = success ? accounts[0]?.accountId ?? "" : "";
          if (id && isNearAccountId(id)) useNativeWallets.getState().setNear(id);
        });
        nearConnector.on("wallet:signOut", () => {
          useNativeWallets.getState().disconnectNear();
        });
      }
      return nearConnector;
    });
  }
  return nearConnectorPending;
}

export async function restoreNearSession() {
  try {
    const { accounts } = await (await getNearConnector()).getConnectedWallet();
    const id = accounts[0]?.accountId ?? "";
    if (id && isNearAccountId(id)) useNativeWallets.getState().setNear(id);
  } catch {
    /* not connected */
  }
}

export async function connectNear(): Promise<string> {
  const connector = await getNearConnector();
  await connector.connect();
  const { accounts } = await connector.getConnectedWallet();
  const id = accounts[0]?.accountId ?? "";
  if (id && isNearAccountId(id)) useNativeWallets.getState().setNear(id);
  return id;
}

export async function disconnectNearWallet() {
  try {
    await (await getNearConnector()).disconnect();
  } finally {
    useNativeWallets.getState().disconnectNear();
  }
}

export type { CardanoWalletInfo };

export { listCardanoWallets };

export async function connectCardano(walletId: string): Promise<string> {
  const addr = await enableCardano(walletId);
  useNativeWallets.getState().setCardano(addr, walletId);
  return addr;
}

export async function pingNearRpc(): Promise<string | null> {
  try {
    const res = await fetch("https://rpc.mainnet.near.org", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "status", params: [] }),
    });
    const json = (await res.json()) as { result?: { sync_info?: { latest_block_height?: number } } };
    const h = json.result?.sync_info?.latest_block_height;
    return typeof h === "number" ? String(h) : null;
  } catch {
    return null;
  }
}

export async function pingCardanoTip(): Promise<string | null> {
  try {
    const res = await fetch("https://api.koios.rest/api/v1/tip");
    const json = (await res.json()) as Array<{ block_height?: number }>;
    const h = json[0]?.block_height;
    return typeof h === "number" ? String(h) : null;
  } catch {
    return null;
  }
}

export { isNearAccountId, isCardanoAddress };
