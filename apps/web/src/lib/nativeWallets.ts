import { isCardanoAddress, isNearAccountId, isSolanaAddress } from "@ysk-mint/sdk";
import {
  clearCardanoApi,
  enableCardano,
  listCardanoWallets,
  refreshCardanoIfEnabled,
  type CardanoWalletInfo,
} from "./cardanoCip30.ts";
import { useNativeWallets } from "./nativeWalletStore.ts";
import {
  connectNearSelector,
  disconnectNearSelector,
  syncNearAccount,
} from "./nearSelector.ts";
import {
  connectSolana,
  disconnectSolanaWallet,
  listSolanaWallets,
  restoreSolanaSession,
  type SolanaWalletInfo,
} from "./solanaWallets.ts";

export { useNativeWallets };
export {
  connectAptos,
  connectSui,
  connectTon,
  connectTron,
  disconnectAptosWallet,
  disconnectSuiWallet,
  disconnectTonWallet,
  disconnectTronWallet,
  listAptosWallets,
  listSuiWallets,
  listTronWallets,
  type ExtraWalletInfo,
} from "./extraWallets.ts";

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
  const session = await enableCardano(walletId);
  useNativeWallets.getState().setCardano(session.address, walletId, {
    addresses: session.addresses,
    stake: session.stake,
  });
  return session.address;
}

export async function restoreCardanoSession(): Promise<string> {
  const state = useNativeWallets.getState();
  if (state.cardanoWallet) {
    const session = await refreshCardanoIfEnabled(state.cardanoWallet);
    if (session) {
      useNativeWallets.getState().setCardano(session.address, state.cardanoWallet, {
        addresses: session.addresses,
        stake: session.stake,
      });
      return session.address;
    }
  }
  return state.cardanoAddress;
}

export function disconnectCardanoWallet() {
  clearCardanoApi();
  useNativeWallets.getState().disconnectCardano();
}

export async function pingNearRpc(): Promise<string | null> {
  try {
    const { nearRpc } = await import("./nearRpc.ts");
    const json = await nearRpc("status", []);
    const h = (json.result as { sync_info?: { latest_block_height?: number } } | undefined)?.sync_info?.latest_block_height;
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

export { connectSolana, disconnectSolanaWallet, listSolanaWallets, restoreSolanaSession, isNearAccountId, isCardanoAddress, isSolanaAddress };
export type { SolanaWalletInfo };
