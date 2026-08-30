import { useEffect, useMemo, useState } from "react";
import { BS_TX, INDEX_TX, SCAN_TX, addFlow, chainMeta, fmtAmt, isZeroAddr, mergeTxRows, methodLabel, retouch, type TxRow } from "./txIndex.ts";
import { applyTags } from "./addrLabels.ts";
import { trackLive, useLiveStatus } from "./liveStatus.ts";
import type { AddrKind } from "./addrKind.ts";
import { fetchBlockscout, fetchScan } from "./txs/evm.ts";
import { fetchIndexedEvm } from "./txs/indexedEvm.ts";
import { fetchSol } from "./txs/sol.ts";
import { fetchAda } from "./txs/ada.ts";
import { fetchNear } from "./txs/near.ts";
import {
  applyToken,
  httpJson,
  isFail,
  oursSet,
  partyName,
  peerOf,
  protocolOf,
  type BsParty,
  type BsTok,
  type BsTx,
} from "./txs/shared.ts";

type AddrIn = { kind: AddrKind; value: string };

export async function enrichTx(row: TxRow): Promise<TxRow> {
  const base = BS_TX[row.chainId];
  if (!base) return row;
  const j = await httpJson<BsTx & { token_transfers?: BsTok[] }>(`${base}/api/v2/transactions/${row.hash}`);
  if (!j) return row;
  const next: TxRow = { ...row, flows: [...row.flows] };
  if (j.method || j.decoded_input?.method_call) next.method = methodLabel(j.decoded_input?.method_call || j.method, next.method);
  if (j.from?.hash) {
    next.from = j.from.hash;
    next.fromLabel = partyName(j.from) || next.fromLabel;
  }
  if (j.to?.hash) {
    next.to = j.to.hash;
    next.toLabel = partyName(j.to) || next.toLabel;
  }
  if (isFail(j.status, j.result)) {
    next.fail = true;
    next.kind = "fail";
  }
  if (j.to?.is_scam || j.from?.is_scam) next.risk = true;
  const proto = protocolOf(row.chainId, new Set([row.ours.toLowerCase()]), next.from, next.to, j.from, j.to);
  if (proto) {
    next.protocol = proto;
    next.peerLabel = proto;
  }
  const ours = new Set([row.ours.toLowerCase()]);
  for (const t of j.token_transfers ?? []) applyToken(next, t, row.ours, ours, row.chainId);
  const internals = await httpJson<{ items?: Array<{ from?: BsParty; to?: BsParty; value?: string; success?: boolean }> }>(
    `${base}/api/v2/transactions/${row.hash}/internal-transactions`,
  );
  const meta = chainMeta(row.chainId);
  const a = row.ours.toLowerCase();
  for (const it of internals?.items ?? []) {
    let val = 0n;
    try {
      val = BigInt(it.value || "0");
    } catch {
      val = 0n;
    }
    if (!val) continue;
    const from = it.from?.hash || "";
    const to = it.to?.hash || "";
    const dir: "in" | "out" | null = to.toLowerCase() === a ? "in" : from.toLowerCase() === a ? "out" : null;
    if (!dir) continue;
    addFlow(next.flows, {
      symbol: meta.native,
      icon: meta.icon,
      amount: fmtAmt(val, meta.decimals),
      dir,
      counter: dir === "in" ? from : to,
    });
    if (dir === "in" && to && !next.peer) next.peer = from;
    if (dir === "out" && from && !isZeroAddr(to)) next.peer = next.peer || to;
  }
  if (!next.peer) next.peer = peerOf(ours, next.from, next.to);
  return applyTags(retouch(next));
}

export function useAddressTxs(addrs: AddrIn[]) {
  const key = addrs.map((a) => `${a.kind}:${a.value}`).join("|");
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [failedChains, setFailedChains] = useState<Set<number>>(() => new Set());
  const list = useMemo(() => addrs, [key]);

  useEffect(() => {
    if (!list.length) {
      setRows([]);
      setLoading(false);
      setFailed(false);
      setFailedChains(new Set());
      return;
    }
    let cancelled = false;
    setRows([]);
    setLoading(true);
    setFailed(false);
    setFailedChains(new Set());
    const jobs: Array<{ id: string; chainId: number; run: () => Promise<TxRow[]> }> = [];
    const ours = oursSet(list);
    const prefer = [1, 43114, 8453, 42161, 56, 137, 10, 480, 101, 1815, 397];
    const rank = (id: number) => {
      const i = prefer.indexOf(id);
      return i === -1 ? 50 + id : i;
    };
    for (const a of list) {
      if (a.kind === "evm") {
        for (const id of Object.keys(BS_TX).map(Number)) {
          jobs.push({ id: `txs:${id}:${a.value}`, chainId: id, run: () => fetchBlockscout(id, a.value, ours) });
        }
        for (const id of Object.keys(SCAN_TX).map(Number)) {
          jobs.push({ id: `txs:${id}:${a.value}`, chainId: id, run: () => fetchScan(id, a.value, ours) });
        }
        for (const id of INDEX_TX) {
          jobs.push({ id: `txs:${id}:${a.value}`, chainId: id, run: () => fetchIndexedEvm(id, a.value, ours) });
        }
      } else if (a.kind === "solana") jobs.push({ id: `txs:101:${a.value}`, chainId: 101, run: () => fetchSol(a.value) });
      else if (a.kind === "cardano") jobs.push({ id: `txs:1815:${a.value}`, chainId: 1815, run: () => fetchAda(a.value) });
      else if (a.kind === "near") jobs.push({ id: `txs:397:${a.value}`, chainId: 397, run: () => fetchNear(a.value) });
    }
    jobs.sort((a, b) => rank(a.chainId) - rank(b.chainId));
    void (async () => {
      let ok = false;
      const dead = new Set<number>();
      let i = 0;
      const worker = async () => {
        while (i < jobs.length && !cancelled) {
          const j = jobs[i++];
          if (!j) break;
          try {
            await trackLive(j.id, j.chainId, "txs", async () => {
              const part = await j.run();
              if (!cancelled && part.length) setRows((prev) => mergeTxRows(prev, part));
              return part;
            });
            ok = true;
          } catch {
            dead.add(j.chainId);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(6, jobs.length) }, () => worker()));
      if (cancelled) return;
      setFailedChains(dead);
      setFailed(jobs.length > 0 && !ok);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      useLiveStatus.getState().clear("txs:");
    };
  }, [key]);

  return { rows, loading, failed, failedChains };
}
