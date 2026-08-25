import { isSolanaAddress } from "@ysk-mint/sdk";
import { useNativeWallets } from "./nativeWalletStore.ts";

export type SolanaWalletInfo = {
  id: string;
  name: string;
  icon?: string;
  installed: boolean;
  url?: string;
};

/** Popular Solana wallets. Installed ones come from Wallet Standard / injected providers. */
export const SOLANA_CATALOG: Array<{ name: string; url: string; icon: string }> = [
  { name: "Phantom", url: "https://phantom.app/download", icon: "/wallets/phantom.svg" },
  { name: "Solflare", url: "https://solflare.com/download", icon: "/wallets/solflare.svg" },
  { name: "Backpack", url: "https://backpack.app/download", icon: "/wallets/backpack.png" },
  { name: "Brave Wallet", url: "https://brave.com/wallet/", icon: "/wallets/brave.svg" },
  { name: "Glow", url: "https://glow.app/", icon: "/wallets/glow.png" },
  { name: "Coinbase Wallet", url: "https://www.coinbase.com/wallet/downloads", icon: "/wallets/coinbase.svg" },
  { name: "Ledger", url: "https://www.ledger.com/ledger-live", icon: "/wallets/ledger.svg" },
  { name: "Trust Wallet", url: "https://trustwallet.com/download", icon: "/wallets/trust.svg" },
  { name: "Exodus", url: "https://www.exodus.com/download", icon: "/wallets/exodus.svg" },
  { name: "OKX Wallet", url: "https://www.okx.com/web3", icon: "/wallets/okx.svg" },
  { name: "Bitget Wallet", url: "https://web3.bitget.com/en/wallet-download", icon: "/wallets/bitget.svg" },
  { name: "Nightly", url: "https://nightly.app/", icon: "/wallets/nightly.svg" },
];

function catalogIcon(name: string): string | undefined {
  return SOLANA_CATALOG.find((c) => sameWallet(c.name, name))?.icon;
}

function readIcon(icon: unknown, name: string): string | undefined {
  const local = catalogIcon(name);
  if (local) return local;
  if (typeof icon === "string" && (icon.startsWith("data:") || icon.startsWith("/") || icon.startsWith("http"))) {
    return icon;
  }
  return undefined;
}

type StandardAccount = { address: string };
type StandardWallet = {
  name: string;
  icon?: string;
  chains?: string[];
  accounts?: StandardAccount[];
  features: Record<string, unknown>;
};

type Injected = {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  publicKey?: { toBase58?: () => string; toString: () => string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: { toBase58?: () => string; toString: () => string } } | void>;
  disconnect?: () => Promise<void>;
};

let standard: StandardWallet | null = null;
let injected: Injected | null = null;

function addrOf(k: { toBase58?: () => string; toString: () => string } | string | undefined | null): string {
  if (!k) return "";
  if (typeof k === "string") return k;
  return k.toBase58?.() ?? k.toString();
}

function asInjected(v: unknown): Injected | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Injected;
  return typeof o.connect === "function" ? o : null;
}

function windowProviders(): Array<{ id: string; name: string; provider: Injected }> {
  const w = window as unknown as {
    phantom?: { solana?: Injected };
    solflare?: Injected;
    backpack?: { solana?: Injected };
    solana?: Injected;
  };
  const out: Array<{ id: string; name: string; provider: Injected }> = [];
  const phantom = asInjected(w.phantom?.solana) ?? (w.solana?.isPhantom ? asInjected(w.solana) : null);
  if (phantom) out.push({ id: "phantom", name: "Phantom", provider: phantom });
  const solflare = asInjected(w.solflare);
  if (solflare && !out.some((x) => x.provider === solflare)) out.push({ id: "solflare", name: "Solflare", provider: solflare });
  const backpack = asInjected(w.backpack?.solana);
  if (backpack) out.push({ id: "backpack", name: "Backpack", provider: backpack });
  const generic = asInjected(w.solana);
  if (generic && !out.some((x) => x.provider === generic)) out.push({ id: "solana", name: "Solana", provider: generic });
  return out;
}

function sameWallet(a: string, b: string) {
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase().replace(/wallet/g, "");
  return norm(a) === norm(b) || norm(a).includes(norm(b)) || norm(b).includes(norm(a));
}

export async function listSolanaWallets(): Promise<SolanaWalletInfo[]> {
  const installed: SolanaWalletInfo[] = [];
  try {
    const { getWallets } = await import("@wallet-standard/app");
    const wallets = getWallets().get() as unknown as StandardWallet[];
    for (const w of wallets) {
      const sol = (w.chains ?? []).some((c) => c.startsWith("solana:"));
      if (!sol || !("standard:connect" in w.features)) continue;
      if (installed.some((x) => sameWallet(x.name, w.name))) continue;
      installed.push({
        id: `std:${w.name}`,
        name: w.name,
        icon: readIcon(w.icon, w.name),
        installed: true,
      });
    }
  } catch {
    /* package missing or not registered yet */
  }
  for (const p of windowProviders()) {
    if (installed.some((w) => sameWallet(w.name, p.name))) continue;
    installed.push({ id: p.id, name: p.name, icon: catalogIcon(p.name), installed: true });
  }
  const rest = SOLANA_CATALOG.filter((c) => !installed.some((w) => sameWallet(w.name, c.name))).map((c) => ({
    id: `install:${c.name}`,
    name: c.name,
    url: c.url,
    icon: c.icon,
    installed: false,
  }));
  return [...installed, ...rest];
}

async function connectStandard(name: string): Promise<string> {
  const { getWallets } = await import("@wallet-standard/app");
  const wallet = (getWallets().get() as unknown as StandardWallet[]).find((w) => w.name === name);
  if (!wallet) throw new Error("Solana wallet not found");
  const feat = wallet.features["standard:connect"] as { connect: () => Promise<{ accounts: StandardAccount[] }> };
  const { accounts } = await feat.connect();
  const address = accounts[0]?.address ?? wallet.accounts?.[0]?.address ?? "";
  if (!isSolanaAddress(address)) throw new Error("Invalid Solana address");
  standard = wallet;
  injected = null;
  useNativeWallets.getState().setSolana(address, `std:${wallet.name}`);
  return address;
}

async function connectInjected(id: string): Promise<string> {
  const found = windowProviders().find((p) => p.id === id) ?? windowProviders()[0];
  if (!found) throw new Error("No Solana wallet");
  const res = await found.provider.connect();
  const address = addrOf(res && typeof res === "object" ? res.publicKey : undefined) || addrOf(found.provider.publicKey);
  if (!isSolanaAddress(address)) throw new Error("Invalid Solana address");
  injected = found.provider;
  standard = null;
  useNativeWallets.getState().setSolana(address, found.id);
  return address;
}

export async function connectSolana(walletId?: string): Promise<string> {
  if (walletId?.startsWith("std:")) return connectStandard(walletId.slice(4));
  if (walletId) {
    try {
      return await connectStandard(walletId);
    } catch {
      return connectInjected(walletId);
    }
  }
  const listed = await listSolanaWallets();
  if (!listed.length) throw new Error("No Solana wallet");
  return connectSolana(listed[0]!.id);
}

export async function disconnectSolanaWallet() {
  try {
    if (standard && "standard:disconnect" in standard.features) {
      await (standard.features["standard:disconnect"] as { disconnect: () => Promise<void> }).disconnect();
    } else if (injected?.disconnect) {
      await injected.disconnect();
    }
  } catch {
    /* ignore */
  }
  standard = null;
  injected = null;
  useNativeWallets.getState().disconnectSolana();
}

export async function restoreSolanaSession() {
  const saved = useNativeWallets.getState().solanaAddress;
  if (saved && isSolanaAddress(saved)) return saved;
  for (const p of windowProviders()) {
    try {
      const res = await p.provider.connect({ onlyIfTrusted: true });
      const address = addrOf(res && typeof res === "object" ? res.publicKey : undefined) || addrOf(p.provider.publicKey);
      if (isSolanaAddress(address)) {
        injected = p.provider;
        useNativeWallets.getState().setSolana(address, p.id);
        return address;
      }
    } catch {
      /* not trusted */
    }
  }
  return "";
}
