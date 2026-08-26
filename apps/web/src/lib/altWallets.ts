import { useNativeWallets } from "./nativeWalletStore.ts";
import type { ExtraWalletInfo } from "./extraWallets.ts";

function win() {
  return window as unknown as Record<string, unknown>;
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
}

export function listBitcoinWallets(): ExtraWalletInfo[] {
  const w = win();
  const unisat = Boolean(w.unisat);
  const xverse = Boolean(w.XverseProviders || w.BitcoinProvider);
  return [
    { id: unisat ? "unisat" : "install:UniSat", name: "UniSat", url: "https://unisat.io", icon: "/tokens/btc.png", installed: unisat },
    { id: xverse ? "xverse" : "install:Xverse", name: "Xverse", url: "https://www.xverse.app", icon: "/tokens/btc.png", installed: xverse },
  ];
}

function firstBtcAddress(res: unknown): string {
  const top = asRecord(res);
  const result = asRecord(top?.result) ?? top;
  const nested = asRecord(result?.result);
  const list = (result?.addresses ?? nested?.addresses ?? top?.addresses) as Array<{ address?: string; purpose?: string }> | undefined;
  if (!Array.isArray(list)) return "";
  return list.find((a) => a.purpose === "payment")?.address || list[0]?.address || "";
}

export async function connectBitcoin(walletId: string) {
  const w = win();
  if (walletId === "unisat" || walletId.startsWith("install:UniSat") || (!walletId && w.unisat)) {
    const u = w.unisat as { requestAccounts?: () => Promise<string[]> } | undefined;
    if (!u?.requestAccounts) throw new Error("未偵測 UniSat");
    const acc = await u.requestAccounts();
    const address = acc[0] ?? "";
    if (!address) throw new Error("Bitcoin 地址讀取失敗");
    useNativeWallets.getState().setBitcoin(address, "unisat");
    return address;
  }
  const xv =
    (asRecord(w.XverseProviders)?.BitcoinProvider as { request?: (m: string, a?: unknown) => Promise<unknown> } | undefined) ||
    (w.BitcoinProvider as { request?: (m: string, a?: unknown) => Promise<unknown> } | undefined);
  if (!xv?.request) throw new Error("未偵測 Xverse");
  let res: unknown;
  try {
    res = await xv.request("wallet_connect", { addresses: ["payment"] });
  } catch {
    res = await xv.request("getAccounts", { purposes: ["payment"] });
  }
  const address = firstBtcAddress(res);
  if (!address) throw new Error("Bitcoin 地址讀取失敗");
  useNativeWallets.getState().setBitcoin(address, "xverse");
  return address;
}

export function disconnectBitcoinWallet() {
  useNativeWallets.getState().disconnectBitcoin();
}

export function listXrplWallets(): ExtraWalletInfo[] {
  const w = win();
  const cm = Boolean(w.crossmark);
  return [
    { id: cm ? "crossmark" : "install:Crossmark", name: "Crossmark", url: "https://crossmark.io", icon: "/tokens/xrp.png", installed: cm },
    { id: "install:GemWallet", name: "GemWallet", url: "https://gemwallet.app", icon: "/tokens/xrp.png", installed: false },
  ];
}

export async function connectXrpl(walletId: string) {
  if (walletId && walletId !== "crossmark") throw new Error("請用 Crossmark");
  const cm = win().crossmark as
    | {
        signIn?: () => Promise<unknown>;
        methods?: { signIn?: () => Promise<unknown> };
        async?: { signIn?: () => Promise<unknown> };
      }
    | undefined;
  const signIn = cm?.signIn || cm?.methods?.signIn || cm?.async?.signIn;
  if (!signIn) throw new Error("未偵測 Crossmark");
  const res = asRecord(await signIn());
  const data = asRecord(asRecord(res?.response)?.data) ?? asRecord(res?.data) ?? res;
  const address = typeof data?.address === "string" ? data.address : "";
  if (!address) throw new Error("XRPL 地址讀取失敗");
  useNativeWallets.getState().setXrpl(address, "crossmark");
  return address;
}

export function disconnectXrplWallet() {
  useNativeWallets.getState().disconnectXrpl();
}

export function listStellarWallets(): ExtraWalletInfo[] {
  const w = win();
  const fr = Boolean(w.freighterApi || w.freighter);
  return [{ id: fr ? "freighter" : "install:Freighter", name: "Freighter", url: "https://freighter.app", icon: "/tokens/xlm.png", installed: fr }];
}

export async function connectStellar() {
  const api = (win().freighterApi || win().freighter) as {
    requestAccess?: () => Promise<unknown>;
    getAddress?: () => Promise<unknown>;
  };
  if (!api?.requestAccess) throw new Error("未偵測 Freighter");
  const raw = await api.requestAccess();
  const pick = (v: unknown) => (typeof v === "string" ? v : (asRecord(v)?.address as string | undefined) || "");
  let address = pick(raw);
  if (!address && api.getAddress) address = pick(await api.getAddress());
  if (!address) throw new Error("Stellar 地址讀取失敗");
  useNativeWallets.getState().setStellar(address, "freighter");
  return address;
}

export function disconnectStellarWallet() {
  useNativeWallets.getState().disconnectStellar();
}

const KEPLR_CHAINS = [
  { id: "cosmoshub-4", field: "cosmos" as const },
  { id: "osmosis-1", field: "osmosis" as const },
  { id: "celestia", field: "celestia" as const },
];

export function listKeplrWallets(): ExtraWalletInfo[] {
  const installed = Boolean(win().keplr);
  return [{ id: installed ? "keplr" : "install:Keplr", name: "Keplr", url: "https://www.keplr.app", icon: "/tokens/atom.png", installed }];
}

export async function connectKeplr() {
  const keplr = win().keplr as
    | { enable: (ids: string[]) => Promise<void>; getKey: (id: string) => Promise<{ bech32Address: string }> }
    | undefined;
  if (!keplr) throw new Error("未偵測 Keplr");
  const addrs = { cosmos: "", osmosis: "", celestia: "" };
  for (const c of KEPLR_CHAINS) {
    try {
      await keplr.enable([c.id]);
      addrs[c.field] = (await keplr.getKey(c.id)).bech32Address;
    } catch {
      addrs[c.field] = "";
    }
  }
  if (!addrs.cosmos && !addrs.osmosis && !addrs.celestia) throw new Error("Keplr 地址讀取失敗");
  useNativeWallets.getState().setKeplr(addrs, "keplr");
  return addrs.cosmos || addrs.osmosis || addrs.celestia;
}

export function disconnectKeplrWallet() {
  useNativeWallets.getState().disconnectKeplr();
}

export function listStarknetWallets(): ExtraWalletInfo[] {
  const w = win();
  const argent = Boolean(w["starknet-argentX"]);
  const braavos = Boolean(w["starknet-braavos"]);
  return [
    { id: argent ? "argent" : "install:Argent", name: "Argent X", url: "https://www.argent.xyz/argent-x", icon: "/tokens/strk.png", installed: argent },
    { id: braavos ? "braavos" : "install:Braavos", name: "Braavos", url: "https://braavos.app", icon: "/tokens/strk.png", installed: braavos },
  ];
}

export async function connectStarknet(walletId?: string) {
  const w = win();
  const pick =
    (walletId === "braavos" ? w["starknet-braavos"] : walletId === "argent" ? w["starknet-argentX"] : undefined) ||
    w["starknet-argentX"] ||
    w["starknet-braavos"] ||
    w.starknet;
  const sn = pick as { enable?: () => Promise<string[] | void>; selectedAddress?: string; account?: { address?: string }; id?: string } | undefined;
  if (!sn?.enable) throw new Error("未偵測 Argent／Braavos");
  const acc = await sn.enable();
  const address = (Array.isArray(acc) ? acc[0] : "") || sn.selectedAddress || sn.account?.address || "";
  if (!address) throw new Error("Starknet 地址讀取失敗");
  const tag = walletId === "braavos" || sn.id?.toLowerCase().includes("braavos") ? "braavos" : "argent";
  useNativeWallets.getState().setStarknet(address, tag);
  return address;
}

export function disconnectStarknetWallet() {
  useNativeWallets.getState().disconnectStarknet();
}
