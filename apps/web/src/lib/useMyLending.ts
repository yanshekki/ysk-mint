import { useEffect, useState } from "react";
import { type Address } from "viem";
import { useAccount, useConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { readAave, type ProtocolLine } from "./defiPositions.ts";
import { readExtraLending, type LendCard } from "./lendingExtra.ts";
import { readNativeLending } from "./lendingNative.ts";
import { readBurrow } from "./nearDex.ts";
import { readBenqiMarkets } from "./stakingPositions.ts";
import { useNativeWallets } from "./nativeWallets.ts";
import type { Quote } from "./defiQuotes.ts";
import { lendChainIds } from "./lendMarkets.ts";
import { useUserSettings } from "./userSettings.ts";
import { isDefiEnabled } from "./defiScan.ts";

export type MyLendRow = ProtocolLine & { protocol: string; health: string };

function flatten(cards: LendCard[]): MyLendRow[] {
  const out: MyLendRow[] = [];
  for (const c of cards) {
    for (const l of c.lines) out.push({ ...l, protocol: c.protocol, health: c.health });
  }
  return out;
}

export function useMyLending(chainFilter: number | "all") {
  const { address } = useAccount();
  const native = useNativeWallets();
  const config = useConfig();
  const disabled = useUserSettings((s) => s.disabledChains);
  const disabledDefi = useUserSettings((s) => s.disabledDefi);
  const lendCore = isDefiEnabled("lendCore", disabledDefi);
  const lendExtra = isDefiEnabled("lendExtra", disabledDefi);
  const [rows, setRows] = useState<MyLendRow[]>([]);
  const [loading, setLoading] = useState(false);

  const evm = address as Address | undefined;
  const near = native.nearAccount;
  const sol = native.solanaAddress;
  const sui = native.suiAddress;
  const tron = native.tronAddress;
  const aptos = native.aptosAddress;

  useEffect(() => {
    if ((!evm && !near && !sol && !sui && !tron && !aptos) || (!lendCore && !lendExtra)) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const cards: LendCard[] = [];
      const quotes = new Map<string, Quote>();
      const ids = lendChainIds(chainFilter, disabled);
      try {
        if (evm) {
          await Promise.all(
            ids.map(async (id) => {
              const client = getPublicClient(config, { chainId: id });
              if (!client) return;
              if (lendCore) {
                const a = await readAave(client, id, evm).catch(() => null);
                if (a) cards.push({ ...a, protocol: "Aave" });
              }
              if (lendExtra) {
                const extra = await readExtraLending(client, id, evm, quotes).catch(() => []);
                cards.push(...extra);
              }
              if (id === 43114 && lendCore) {
                const b = await readBenqiMarkets(client, evm, quotes).catch(() => null);
                if (b) cards.push({ ...b, protocol: "BENQI", lines: b.lines.filter((l) => l.side !== "lp") });
              }
            }),
          );
        }
        if (lendCore && near && (chainFilter === "all" || chainFilter === 397)) {
          const b = await readBurrow(near).catch(() => null);
          if (b) cards.push({ ...b, protocol: "Burrow" });
        }
        if (sol || sui || tron || aptos) {
          const more = await readNativeLending({
            sol: chainFilter === "all" || chainFilter === 101 ? sol : undefined,
            sui: chainFilter === "all" || chainFilter === 784 ? sui : undefined,
            tron: chainFilter === "all" || chainFilter === 728126428 ? tron : undefined,
            aptos: chainFilter === "all" || chainFilter === 637 ? aptos : undefined,
            quotes,
            core: lendCore,
            extra: lendExtra,
          }).catch(() => []);
          cards.push(...more);
        }
      } catch {
        /* empty */
      }
      if (!cancelled) {
        setRows(flatten(cards));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [evm, near, sol, sui, tron, aptos, chainFilter, config, disabled, lendCore, lendExtra]);

  return { rows, loading };
}
