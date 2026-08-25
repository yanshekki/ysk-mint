import type { WalletModuleFactory, WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { isNearAccountId } from "@ysk-mint/sdk";
import { useNativeWallets } from "./nativeWalletStore.ts";

type NearKit = { selector: WalletSelector; modal: WalletSelectorModal };

let kit: NearKit | null = null;
let pending: Promise<NearKit> | null = null;
let listenersBound = false;

async function ensureBuffer() {
  const g = globalThis as unknown as { Buffer?: unknown };
  if (g.Buffer) return;
  const { Buffer } = await import("buffer");
  g.Buffer = Buffer;
}

/** Official NEAR Wallet Selector (near/wallet-selector). Not HOT Connect. */
export async function getNearSelector(): Promise<NearKit> {
  if (kit) return kit;
  if (!pending) {
    pending = (async () => {
      await ensureBuffer();
      const [
        { setupWalletSelector },
        { setupModal },
        { setupMeteorWallet },
        { setupMyNearWallet },
        { setupHereWallet },
        { setupNightly },
        { setupSender },
        { setupLedger },
        { setupNearMobileWallet },
        { setupWelldoneWallet },
        { setupBitteWallet },
        { setupIntearWallet },
      ] = await Promise.all([
        import("@near-wallet-selector/core"),
        import("@near-wallet-selector/modal-ui"),
        import("@near-wallet-selector/meteor-wallet"),
        import("@near-wallet-selector/my-near-wallet"),
        import("@near-wallet-selector/here-wallet"),
        import("@near-wallet-selector/nightly"),
        import("@near-wallet-selector/sender"),
        import("@near-wallet-selector/ledger"),
        import("@near-wallet-selector/near-mobile-wallet"),
        import("@near-wallet-selector/welldone-wallet"),
        import("@near-wallet-selector/bitte-wallet"),
        import("@near-wallet-selector/intear-wallet"),
      ]);

      const modules = [
        setupMeteorWallet(),
        setupMyNearWallet(),
        setupHereWallet(),
        setupNightly(),
        setupSender(),
        setupLedger(),
        setupNearMobileWallet(),
        setupWelldoneWallet(),
        setupBitteWallet(),
        setupIntearWallet(),
      ] as WalletModuleFactory[];
      const selector = await setupWalletSelector({
        network: "mainnet",
        modules,
      });

      const modal = setupModal(selector, {
        contractId: "",
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
    })();
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

  return new Promise((resolve) => {
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
      finish(id);
    });
    const hidden = modal.on("onHide", () => {
      finish(useNativeWallets.getState().nearAccount);
    });
    modal.show();
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
