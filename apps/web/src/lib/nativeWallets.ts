import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isCardanoAddress, isNearAccountId } from "@ysk-mint/sdk";

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

export function captureNearRedirect() {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  const account = q.get("account_id");
  if (account && isNearAccountId(account)) {
    useNativeWallets.getState().setNear(account);
    q.delete("account_id");
    q.delete("all_keys");
    q.delete("public_key");
    const url = `${window.location.pathname}${q.toString() ? `?${q}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", url);
  }
}

type CardanoInjected = {
  name?: string;
  icon?: string;
  enable: () => Promise<{
    getUsedAddresses?: () => Promise<string[]>;
    getChangeAddress?: () => Promise<string>;
  }>;
};

export function listCardanoWallets(): { key: string; name: string }[] {
  if (typeof window === "undefined" || !window.cardano) return [];
  return Object.entries(window.cardano)
    .filter(([, w]) => w && typeof (w as CardanoInjected).enable === "function")
    .map(([key, w]) => ({ key, name: (w as CardanoInjected).name || key }));
}

export async function connectCardano(key: string): Promise<string> {
  const w = window.cardano?.[key] as CardanoInjected | undefined;
  if (!w) throw new Error("wallet");
  const api = await w.enable();
  const change = api.getChangeAddress ? await api.getChangeAddress() : "";
  const used = api.getUsedAddresses ? await api.getUsedAddresses() : [];
  const raw = change || used[0] || "";
  if (!raw) throw new Error("address");
  useNativeWallets.getState().setCardano(raw, key);
  return raw;
}

export async function connectNearInjected(): Promise<string | null> {
  const near = window.near;
  if (near?.requestSignIn) {
    await near.requestSignIn({});
    const id = near.getAccountId?.() || "";
    if (id && isNearAccountId(id)) {
      useNativeWallets.getState().setNear(id);
      return id;
    }
  }
  if (near?.isSignedIn?.() && near.getAccountId) {
    const id = near.getAccountId();
    if (id && isNearAccountId(id)) {
      useNativeWallets.getState().setNear(id);
      return id;
    }
  }
  return null;
}

export function openMyNearWallet() {
  const success = new URL(window.location.href);
  const url = new URL("https://app.mynearwallet.com/login/");
  url.searchParams.set("title", "ysk-mint");
  url.searchParams.set("success_url", success.toString());
  url.searchParams.set("failure_url", success.toString());
  window.location.assign(url.toString());
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

declare global {
  interface Window {
    cardano?: Record<string, CardanoInjected>;
    near?: {
      requestSignIn?: (opts?: { contractId?: string }) => Promise<void>;
      isSignedIn?: () => boolean;
      getAccountId?: () => string;
      signOut?: () => void;
    };
  }
}
