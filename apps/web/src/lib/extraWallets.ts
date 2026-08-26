import { useNativeWallets } from "./nativeWalletStore.ts";

export type ExtraWalletInfo = {
  id: string;
  name: string;
  icon?: string;
  installed: boolean;
  url?: string;
};

type StandardAccount = { address: string };
type StandardWallet = {
  name: string;
  icon?: string;
  chains?: string[];
  accounts?: StandardAccount[];
  features: Record<string, unknown>;
};

function sameWallet(a: string, b: string) {
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase().replace(/wallet/g, "");
  return norm(a) === norm(b) || norm(a).includes(norm(b)) || norm(b).includes(norm(a));
}

async function listStandard(prefix: string, catalog: ExtraWalletInfo[]): Promise<ExtraWalletInfo[]> {
  const installed: ExtraWalletInfo[] = [];
  try {
    const { getWallets } = await import("@wallet-standard/app");
    const wallets = getWallets().get() as unknown as StandardWallet[];
    for (const w of wallets) {
      const hit = (w.chains ?? []).some((c) => c.startsWith(prefix));
      if (!hit || !("standard:connect" in w.features)) continue;
      if (installed.some((x) => sameWallet(x.name, w.name))) continue;
      installed.push({
        id: `std:${w.name}`,
        name: w.name,
        icon: typeof w.icon === "string" ? w.icon : catalog.find((c) => sameWallet(c.name, w.name))?.icon,
        installed: true,
      });
    }
  } catch {
    /* wallet-standard not ready */
  }
  const rest = catalog.filter((c) => !installed.some((w) => sameWallet(w.name, c.name)));
  return [...installed, ...rest];
}

async function connectStandard(prefix: string, walletId: string): Promise<string> {
  const { getWallets } = await import("@wallet-standard/app");
  const name = walletId.startsWith("std:") ? walletId.slice(4) : walletId;
  const wallet = (getWallets().get() as unknown as StandardWallet[]).find((w) => w.name === name && (w.chains ?? []).some((c) => c.startsWith(prefix)));
  if (!wallet) throw new Error("wallet not found");
  const feat = wallet.features["standard:connect"] as { connect: () => Promise<{ accounts: StandardAccount[] }> };
  const { accounts } = await feat.connect();
  const address = accounts[0]?.address ?? wallet.accounts?.[0]?.address ?? "";
  if (!address) throw new Error("no address");
  return address;
}

const SUI_CATALOG: ExtraWalletInfo[] = [
  { id: "install:Slush", name: "Slush", url: "https://suiwallet.com", icon: "/tokens/sui.png", installed: false },
  { id: "install:Suiet", name: "Suiet", url: "https://suiet.app", icon: "/tokens/sui.png", installed: false },
];

const APTOS_CATALOG: ExtraWalletInfo[] = [
  { id: "install:Petra", name: "Petra", url: "https://petra.app", icon: "/tokens/apt.png", installed: false },
  { id: "install:Martian", name: "Martian", url: "https://martianwallet.xyz", icon: "/tokens/apt.png", installed: false },
];

export function listSuiWallets() {
  return listStandard("sui:", SUI_CATALOG);
}

export function listAptosWallets() {
  return listStandard("aptos:", APTOS_CATALOG);
}

export async function connectSui(walletId: string) {
  const address = await connectStandard("sui:", walletId);
  useNativeWallets.getState().setSui(address, walletId);
  return address;
}

export async function connectAptos(walletId: string) {
  const address = await connectStandard("aptos:", walletId);
  useNativeWallets.getState().setAptos(address, walletId);
  return address;
}

export function disconnectSuiWallet() {
  useNativeWallets.getState().disconnectSui();
}

export function disconnectAptosWallet() {
  useNativeWallets.getState().disconnectAptos();
}

type TronLink = {
  request: (args: { method: string }) => Promise<unknown>;
};

export async function connectTron() {
  const w = window as unknown as { tronLink?: TronLink; tronWeb?: { defaultAddress?: { base58?: string } } };
  if (!w.tronLink) throw new Error("未偵測 TronLink");
  await w.tronLink.request({ method: "tron_requestAccounts" });
  const address = w.tronWeb?.defaultAddress?.base58 ?? "";
  if (!address) throw new Error("Tron 地址讀取失敗");
  useNativeWallets.getState().setTron(address, "tronlink");
  return address;
}

export function disconnectTronWallet() {
  useNativeWallets.getState().disconnectTron();
}

export function listTronWallets(): ExtraWalletInfo[] {
  const w = window as unknown as { tronLink?: unknown };
  const installed = Boolean(w.tronLink);
  return [
    {
      id: installed ? "tronlink" : "install:TronLink",
      name: "TronLink",
      url: "https://www.tronlink.org",
      icon: "/tokens/trx.png",
      installed,
    },
  ];
}

type TonUi = {
  openModal: () => Promise<void>;
  disconnect: () => Promise<void>;
  account?: { address: string } | null;
  onStatusChange: (cb: (wallet: { account?: { address: string } } | null) => void) => () => void;
};

let tonUi: TonUi | null = null;

async function getTonUi(): Promise<TonUi> {
  if (tonUi) return tonUi;
  const { TonConnectUI } = await import("@tonconnect/ui");
  tonUi = new TonConnectUI({
    manifestUrl: `${window.location.origin}/tonconnect-manifest.json`,
  }) as unknown as TonUi;
  return tonUi;
}

export async function connectTon() {
  const ui = await getTonUi();
  if (ui.account?.address) {
    useNativeWallets.getState().setTon(ui.account.address, "tonconnect");
    return ui.account.address;
  }
  await ui.openModal();
  const address = await new Promise<string>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("TON 連接逾時")), 120000);
    const unsub = ui.onStatusChange((wallet) => {
      const next = wallet?.account?.address;
      if (!next) return;
      window.clearTimeout(timer);
      unsub();
      resolve(next);
    });
  });
  useNativeWallets.getState().setTon(address, "tonconnect");
  return address;
}

export async function disconnectTonWallet() {
  try {
    await tonUi?.disconnect();
  } catch {
    /* ignore */
  }
  useNativeWallets.getState().disconnectTon();
}

export function restoreExtraSessions() {
  /* persist only — do not prompt */
}
