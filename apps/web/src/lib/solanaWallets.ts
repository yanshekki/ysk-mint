import { isSolanaAddress } from "@ysk-mint/sdk";
import { useNativeWallets } from "./nativeWalletStore.ts";

export type SolanaWalletInfo = { id: string; name: string; icon?: string };

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

export async function listSolanaWallets(): Promise<SolanaWalletInfo[]> {
  const listed: SolanaWalletInfo[] = [];
  try {
    const { getWallets } = await import("@wallet-standard/app");
    const wallets = getWallets().get() as unknown as StandardWallet[];
    for (const w of wallets) {
      const sol = (w.chains ?? []).some((c) => c.startsWith("solana:"));
      if (!sol || !("standard:connect" in w.features)) continue;
      listed.push({ id: `std:${w.name}`, name: w.name, icon: typeof w.icon === "string" ? w.icon : undefined });
    }
  } catch {
    /* package missing or not registered yet */
  }
  for (const p of windowProviders()) {
    if (!listed.some((w) => w.name.toLowerCase() === p.name.toLowerCase())) {
      listed.push({ id: p.id, name: p.name });
    }
  }
  return listed;
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
