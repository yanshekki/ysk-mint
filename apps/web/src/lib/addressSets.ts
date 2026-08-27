import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAccount } from "wagmi";
import { useMemo } from "react";
import { addrKey, normalizeAddr, type AddrKind } from "./addrKind.ts";
import { fingerprint, usePeekHash } from "./shareSet.ts";
import { useNativeWallets } from "./nativeWalletStore.ts";

export const MAX_ADDRS = 8;
export const MAX_WATCH = 8;

export type SavedAddr = {
  id: string;
  value: string;
  kind: AddrKind;
};

export type WatchSet = {
  id: string;
  name: string;
  addresses: SavedAddr[];
};

export type AddrErr = "full" | "dup" | "invalid";

type State = {
  mine: SavedAddr[];
  watch: WatchSet[];
  activeId: "mine" | string;
  addMine: (kind: AddrKind, value: string) => AddrErr | null;
  removeMine: (id: string) => void;
  addWatch: (name: string) => string | null;
  renameWatch: (id: string, name: string) => void;
  removeWatch: (id: string) => void;
  addWatchAddr: (setId: string, kind: AddrKind, value: string) => AddrErr | null;
  removeWatchAddr: (setId: string, addrId: string) => void;
  setActive: (id: "mine" | string) => void;
  importShared: (name: string, addrs: Array<{ kind: AddrKind; value: string }>) => string | null;
};

function nid() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pushAddr(list: SavedAddr[], kind: AddrKind, value: string): { list: SavedAddr[]; err: AddrErr | null } {
  const v = normalizeAddr(kind, value);
  if (!v) return { list, err: "invalid" };
  if (list.length >= MAX_ADDRS) return { list, err: "full" };
  const k = addrKey(kind, v);
  if (list.some((a) => addrKey(a.kind, a.value) === k)) return { list, err: "dup" };
  return { list: [...list, { id: nid(), kind, value: v }], err: null };
}

export const useAddressSets = create<State>()(
  persist(
    (set, get) => ({
      mine: [],
      watch: [],
      activeId: "mine",
      addMine: (kind, value) => {
        const { list, err } = pushAddr(get().mine, kind, value);
        if (err) return err;
        set({ mine: list });
        return null;
      },
      removeMine: (id) => set({ mine: get().mine.filter((a) => a.id !== id) }),
      addWatch: (name) => {
        const cur = get().watch;
        if (cur.length >= MAX_WATCH) return null;
        const id = nid();
        const label = name.trim() || `Watch ${cur.length + 1}`;
        set({ watch: [...cur, { id, name: label, addresses: [] }], activeId: id });
        return id;
      },
      renameWatch: (id, name) => {
        const label = name.trim();
        if (!label) return;
        set({ watch: get().watch.map((w) => (w.id === id ? { ...w, name: label } : w)) });
      },
      removeWatch: (id) => {
        const watch = get().watch.filter((w) => w.id !== id);
        const activeId = get().activeId === id ? "mine" : get().activeId;
        set({ watch, activeId });
      },
      addWatchAddr: (setId, kind, value) => {
        const cur = get().watch;
        const i = cur.findIndex((w) => w.id === setId);
        if (i < 0) return "invalid";
        const hit = cur[i]!;
        const { list, err } = pushAddr(hit.addresses, kind, value);
        if (err) return err;
        const watch = cur.slice();
        watch[i] = { ...hit, addresses: list };
        set({ watch });
        return null;
      },
      removeWatchAddr: (setId, addrId) => {
        set({
          watch: get().watch.map((w) => (w.id === setId ? { ...w, addresses: w.addresses.filter((a) => a.id !== addrId) } : w)),
        });
      },
      setActive: (id) => {
        if (id !== "mine" && !get().watch.some((w) => w.id === id)) set({ activeId: "mine" });
        else set({ activeId: id });
      },
      importShared: (name, addrs) => {
        const fp = fingerprint(addrs);
        if (!fp) return null;
        const hit = get().watch.find((w) => fingerprint(w.addresses) === fp);
        if (hit) {
          set({ activeId: hit.id });
          return hit.id;
        }
        if (get().watch.length >= MAX_WATCH) return null;
        const id = nid();
        let addresses: SavedAddr[] = [];
        for (const a of addrs) {
          const next = pushAddr(addresses, a.kind, a.value);
          if (!next.err) addresses = next.list;
        }
        if (!addresses.length) return null;
        const label = name.trim() || `Watch ${get().watch.length + 1}`;
        set({ watch: [...get().watch, { id, name: label, addresses }], activeId: id });
        return id;
      },
    }),
    { name: "ysk-mint.addressSets", version: 1 },
  ),
);

export type SnapAddr = {
  id: string;
  value: string;
  kind: AddrKind;
  source: "connected" | "manual";
  cardanoAddresses?: string[];
  cardanoStake?: string;
};

export type AddrSnap = {
  activeId: "mine" | string;
  isMine: boolean;
  watchName?: string;
  mineCount: number;
  addrs: SnapAddr[];
  byKind: Record<AddrKind, string[]>;
};

function emptyByKind(): Record<AddrKind, string[]> {
  return {
    evm: [],
    near: [],
    cardano: [],
    solana: [],
    tron: [],
    sui: [],
    ton: [],
    aptos: [],
    bitcoin: [],
    xrpl: [],
    stellar: [],
    cosmos: [],
    osmosis: [],
    celestia: [],
    starknet: [],
  };
}

function group(addrs: SnapAddr[]): Record<AddrKind, string[]> {
  const out = emptyByKind();
  const seen = new Set<string>();
  for (const a of addrs) {
    const k = addrKey(a.kind, a.value);
    if (seen.has(k)) continue;
    seen.add(k);
    out[a.kind].push(a.value);
  }
  return out;
}

export function listConnected(bag: {
  evm?: string;
  near?: string;
  cardano?: string;
  cardanoAddresses?: string[];
  cardanoStake?: string;
  solana?: string;
  tron?: string;
  sui?: string;
  ton?: string;
  aptos?: string;
  bitcoin?: string;
  xrpl?: string;
  stellar?: string;
  cosmos?: string;
  osmosis?: string;
  celestia?: string;
  starknet?: string;
}): SnapAddr[] {
  const out: SnapAddr[] = [];
  const add = (kind: AddrKind, value: string | undefined, extra?: Pick<SnapAddr, "cardanoAddresses" | "cardanoStake">) => {
    if (!value) return;
    out.push({ id: `c:${kind}`, value, kind, source: "connected", ...extra });
  };
  add("evm", bag.evm);
  add("near", bag.near);
  add("cardano", bag.cardano, { cardanoAddresses: bag.cardanoAddresses, cardanoStake: bag.cardanoStake });
  add("solana", bag.solana);
  add("tron", bag.tron);
  add("sui", bag.sui);
  add("ton", bag.ton);
  add("aptos", bag.aptos);
  add("bitcoin", bag.bitcoin);
  add("xrpl", bag.xrpl);
  add("stellar", bag.stellar);
  add("cosmos", bag.cosmos);
  add("osmosis", bag.osmosis);
  add("celestia", bag.celestia);
  add("starknet", bag.starknet);
  return out;
}

export function useActiveSnap(): AddrSnap {
  const { address, isConnected } = useAccount();
  const native = useNativeWallets();
  const mine = useAddressSets((s) => s.mine);
  const watch = useAddressSets((s) => s.watch);
  const activeId = useAddressSets((s) => s.activeId);
  const peek = usePeekHash();

  return useMemo(() => {
    const connected = listConnected({
      evm: isConnected ? address : undefined,
      near: native.nearAccount,
      cardano: native.cardanoAddress,
      cardanoAddresses: native.cardanoAddresses,
      cardanoStake: native.cardanoStake,
      solana: native.solanaAddress,
      tron: native.tronAddress,
      sui: native.suiAddress,
      ton: native.tonAddress,
      aptos: native.aptosAddress,
      bitcoin: native.bitcoinAddress,
      xrpl: native.xrplAddress,
      stellar: native.stellarAddress,
      cosmos: native.cosmosAddress,
      osmosis: native.osmosisAddress,
      celestia: native.celestiaAddress,
      starknet: native.starknetAddress,
    });
    const set = activeId === "mine" ? undefined : watch.find((w) => w.id === activeId);
    const isMine = !set;
    const mineAddrs: SnapAddr[] = [
      ...connected,
      ...mine
        .filter((m) => !connected.some((c) => addrKey(c.kind, c.value) === addrKey(m.kind, m.value)))
        .map((m) => ({ ...m, source: "manual" as const })),
    ];
    const addrs: SnapAddr[] = isMine ? mineAddrs : set.addresses.map((a) => ({ ...a, source: "manual" as const }));
    if (peek?.addrs.length) {
      const view: SnapAddr[] = peek.addrs.map((a, i) => ({
        id: `peek:${i}:${a.kind}`,
        kind: a.kind,
        value: a.value,
        source: "manual",
      }));
      return {
        activeId: "peek",
        isMine: false,
        watchName: peek.name,
        mineCount: mineAddrs.length,
        addrs: view,
        byKind: group(view),
      };
    }
    return {
      activeId: isMine ? "mine" : set.id,
      isMine,
      watchName: set?.name,
      mineCount: mineAddrs.length,
      addrs,
      byKind: group(addrs),
    };
  }, [
    activeId,
    peek,
    address,
    isConnected,
    mine,
    native.aptosAddress,
    native.bitcoinAddress,
    native.cardanoAddress,
    native.cardanoAddresses,
    native.cardanoStake,
    native.celestiaAddress,
    native.cosmosAddress,
    native.nearAccount,
    native.osmosisAddress,
    native.solanaAddress,
    native.starknetAddress,
    native.stellarAddress,
    native.suiAddress,
    native.tonAddress,
    native.tronAddress,
    native.xrplAddress,
    watch,
  ]);
}
