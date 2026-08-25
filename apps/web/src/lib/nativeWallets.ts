import { isCardanoAddress, isNearAccountId } from "@ysk-mint/sdk";
import { enableCardano, listCardanoWallets, type CardanoWalletInfo } from "./cardanoCip30.ts";
import { useNativeWallets } from "./nativeWalletStore.ts";
import {
  connectNearSelector,
  disconnectNearSelector,
  syncNearAccount,
} from "./nearSelector.ts";

export { useNativeWallets };

export async function restoreNearSession() {
  try {
    await syncNearAccount();
  } catch {
    /* not connected */
  }
}

export async function connectNear(): Promise<string> {
  return connectNearSelector();
}

export async function disconnectNearWallet() {
  await disconnectNearSelector();
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
