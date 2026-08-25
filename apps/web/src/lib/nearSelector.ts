import type { WalletModuleFactory, WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { isNearAccountId } from "@ysk-mint/sdk";
import { useNativeWallets } from "./nativeWalletStore.ts";

type NearKit = { selector: WalletSelector; modal: WalletSelectorModal };

let kit: NearKit | null = null;
let pending: Promise<NearKit> | null = null;
let listenersBound = false;

async function ensureNodeShims() {
  const g = globalThis as unknown as { Buffer?: unknown; process?: { env?: Record<string, string> } };
  if (!g.Buffer) {
    const { Buffer } = await import("buffer");
    g.Buffer = Buffer;
  }
  if (!g.process) {
    g.process = { env: { NODE_ENV: import.meta.env.MODE } };
  } else if (!g.process.env) {
    g.process.env = { NODE_ENV: import.meta.env.MODE };
  }
}

async function loadWallet(
  name: string,
  load: () => Promise<unknown>,
): Promise<WalletModuleFactory | null> {
  try {
    return (await load()) as WalletModuleFactory;
  } catch (err) {
    console.warn(`[near] skip ${name}`, err);
    return null;
  }
}

/** Official NEAR Wallet Selector (near/wallet-selector). Not HOT Connect. */
export async function getNearSelector(): Promise<NearKit> {
  if (kit) return kit;
  if (!pending) {
    pending = (async () => {
      await ensureNodeShims();
      const modules = (
        await Promise.all([
          loadWallet("meteor", async () => (await import("@near-wallet-selector/meteor-wallet")).setupMeteorWallet()),
          loadWallet("my-near-wallet", async () => (await import("@near-wallet-selector/my-near-wallet")).setupMyNearWallet()),
          loadWallet("here", async () => (await import("@near-wallet-selector/here-wallet")).setupHereWallet()),
          loadWallet("nightly", async () => (await import("@near-wallet-selector/nightly")).setupNightly()),
          loadWallet("sender", async () => (await import("@near-wallet-selector/sender")).setupSender()),
          loadWallet("ledger", async () => (await import("@near-wallet-selector/ledger")).setupLedger()),
          loadWallet("near-mobile", async () => (await import("@near-wallet-selector/near-mobile-wallet")).setupNearMobileWallet()),
          loadWallet("welldone", async () => (await import("@near-wallet-selector/welldone-wallet")).setupWelldoneWallet()),
          loadWallet("bitte", async () => (await import("@near-wallet-selector/bitte-wallet")).setupBitteWallet()),
          loadWallet("intear", async () => (await import("@near-wallet-selector/intear-wallet")).setupIntearWallet()),
        ])
      ).filter((m): m is WalletModuleFactory => m !== null);

      if (!modules.length) throw new Error("NEAR Wallet Selector: no wallet modules loaded");

      const { setupWalletSelector } = await import("@near-wallet-selector/core");
      const { setupModal } = await import("@near-wallet-selector/modal-ui");

      const selector = await setupWalletSelector({
        network: "mainnet",
        modules,
      });

      const modal = setupModal(selector, {
        theme: "light",
        description: "Connect an existing NEAR mainnet wallet",
      });

      if (!listenersBound) {
        listenersBound = true;
        selector.on("signedIn", ({ accounts }) => {
          const id = accounts[0]?.accountId ?? "";
          if (id && isNearAccountId(id)) useNativeWallets.getState().setNear(id);
        });
        selector.on("signedOut", () => {
          useNativeWallets.getState().disconnectNear();
        });
      }

      kit = { selector, modal };
      return kit;
    })().catch((err) => {
      pending = null;
      kit = null;
      throw err;
    });
  }
  return pending;
}

export async function syncNearAccount(): Promise<string> {
  const { selector } = await getNearSelector();
  if (!selector.isSignedIn()) return "";
  try {
    const wallet = await selector.wallet();
    const accounts = await wallet.getAccounts();
    const id = accounts[0]?.accountId ?? "";
    if (id && isNearAccountId(id)) {
      useNativeWallets.getState().setNear(id);
      return id;
    }
  } catch {
    /* no selected wallet */
  }
  return "";
}

export async function connectNearSelector(): Promise<string> {
  const { selector, modal } = await getNearSelector();
  const existing = await syncNearAccount();
  if (existing) return existing;

  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (id: string) => {
      if (done) return;
      done = true;
      signedIn.remove();
      hidden.remove();
      resolve(id);
    };
    const signedIn = selector.on("signedIn", ({ accounts }) => {
      const id = accounts[0]?.accountId ?? "";
      if (id && isNearAccountId(id)) useNativeWallets.getState().setNear(id);
      else if (id) useNativeWallets.getState().setNear(id);
      finish(id);
    });
    const hidden = modal.on("onHide", ({ hideReason }) => {
      if (hideReason === "wallet-navigation") return;
      finish(useNativeWallets.getState().nearAccount);
    });
    try {
      modal.show();
    } catch (err) {
      done = true;
      signedIn.remove();
      hidden.remove();
      reject(err);
    }
  });
}

export async function disconnectNearSelector() {
  try {
    const { selector } = await getNearSelector();
    if (selector.isSignedIn()) {
      const wallet = await selector.wallet();
      await wallet.signOut();
    }
  } finally {
    useNativeWallets.getState().disconnectNear();
  }
}
