import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { shortAddr, type AddrKind } from "../../lib/addrKind.ts";
import { chainIcon } from "../../lib/chainIcon.ts";
import { CHAINS } from "@ysk-mint/config";
import { applyPeekHash } from "../../lib/shareSet.ts";
import { enrichTx } from "../../lib/useAddressTxs.ts";
import { canFollow, chainMeta, isZeroAddr, txIndexed, type TxKind, type TxRow } from "../../lib/txIndex.ts";

const KINDS: TxKind[] = ["in", "out", "swap", "approve", "call", "fail"];

function kindOfChain(chainId: number): AddrKind {
  if (chainId === 101) return "solana";
  if (chainId === 1815) return "cardano";
  if (chainId === 397) return "near";
  return "evm";
}

function relTime(ts: number) {
  if (!ts) return "—";
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 14) return `${Math.floor(s / 86400)}d`;
  return new Date(ts * 1000).toLocaleString();
}

function absTime(ts: number) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString();
}

function chainIco(chainId: number) {
  const c = Object.values(CHAINS).find((x) => x.chainId === chainId);
  return c ? chainIcon(c) : "/tokens/eth.png";
}

function clipHash(hash: string) {
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

export function TxDesk({
  rows,
  loading,
  failed,
  chainFilter,
}: {
  rows: TxRow[];
  loading: boolean;
  failed: boolean;
  chainFilter: number | "all";
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<TxKind | "all">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [extra, setExtra] = useState<Record<string, TxRow>>({});
  const [copied, setCopied] = useState("");
  const [detailing, setDetailing] = useState(false);

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (chainFilter !== "all" && r.chainId !== chainFilter) return false;
      if (kind !== "all" && r.kind !== kind) return false;
      if (!qq) return true;
      return (
        r.hash.toLowerCase().includes(qq) ||
        r.method.toLowerCase().includes(qq) ||
        r.from.toLowerCase().includes(qq) ||
        r.to.toLowerCase().includes(qq) ||
        r.peer.toLowerCase().includes(qq) ||
        (r.protocol || "").toLowerCase().includes(qq) ||
        (r.fromLabel || "").toLowerCase().includes(qq) ||
        (r.toLabel || "").toLowerCase().includes(qq) ||
        r.flows.some((f) => f.symbol.toLowerCase().includes(qq) || (f.token || "").toLowerCase().includes(qq))
      );
    });
  }, [rows, chainFilter, kind, q]);

  useEffect(() => {
    if (!open) return;
    const base = rows.find((r) => r.id === open);
    if (!base || extra[open]) return;
    let cancelled = false;
    setDetailing(true);
    void enrichTx(base)
      .then((next) => {
        if (!cancelled) setExtra((p) => ({ ...p, [open]: next }));
      })
      .finally(() => {
        if (!cancelled) setDetailing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, rows, extra]);

  function peekAddr(chainId: number, value: string, label?: string) {
    if (!value) return;
    const k = kindOfChain(chainId);
    applyPeekHash({ name: label || shortAddr(k, value), addrs: [{ kind: k, value }] }, { push: true });
  }

  function copy(text: string, id: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      window.setTimeout(() => setCopied(""), 1600);
    });
  }

  const noIndex = chainFilter !== "all" && !txIndexed(chainFilter);

  return (
    <section className="me-card">
      <div className="me-card-head">
        <b>{t("me.txTitle")}</b>
        <span className="me-count">{loading ? "…" : list.length}</span>
      </div>
      <p className="me-tx-hint">{t("me.txHint")}</p>
      <div className="me-tx-tools">
        <input className="me-filter" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("me.txSearch")} />
        <div className="me-chips">
          <button type="button" className={`me-chip ${kind === "all" ? "me-chip-on" : ""}`} onClick={() => setKind("all")}>
            {t("me.all")}
          </button>
          {KINDS.map((k) => (
            <button key={k} type="button" className={`me-chip ${kind === k ? "me-chip-on" : ""}`} onClick={() => setKind(k)}>
              {t(`me.txKind.${k}`)}
            </button>
          ))}
        </div>
      </div>
      {loading && list.length === 0 && !noIndex ? (
        <p className="me-card-empty">{t("me.txLoading")}</p>
      ) : failed && list.length === 0 ? (
        <p className="me-card-empty">{t("me.txFail")}</p>
      ) : noIndex && list.length === 0 && !loading ? (
        <p className="me-card-empty">{t("me.txNoIndex")}</p>
      ) : list.length === 0 ? (
        <p className="me-card-empty">{t("me.txEmpty")}</p>
      ) : (
        <div className="me-list me-tx-list">
          <div className="me-tx-cols">
            <span>{t("me.txTime")}</span>
            <span>{t("me.txAct")}</span>
            <span>{t("me.txFlow")}</span>
            <span>{t("me.txGas")}</span>
          </div>
          {list.map((raw) => {
            const r = extra[raw.id] ?? raw;
            const expanded = open === r.id;
            const meta = chainMeta(r.chainId);
            const k = kindOfChain(r.chainId);
            const who = isZeroAddr(r.peer)
              ? t("me.txZero")
              : r.peer
                ? shortAddr(k, r.peer)
                : r.toLabel || r.fromLabel || "—";
            return (
              <div key={r.id} className={`me-tx${r.fail ? " is-fail" : ""}${expanded ? " is-open" : ""}`}>
                <button type="button" className="me-tx-main" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : r.id)}>
                  <span className="me-tx-time" title={absTime(r.ts)}>
                    {relTime(r.ts)}
                    <span className="me-tx-chain">
                      <img src={chainIco(r.chainId)} alt="" width={14} height={14} />
                      {meta.short}
                    </span>
                  </span>
                  <span className="me-tx-act">
                    <b>
                      <span className={`me-tx-kind is-${r.kind}`}>{t(`me.txKind.${r.kind}`)}</span>
                      {r.method}
                      {r.fail ? <span className="badge badge-warn">{t("me.txKind.fail")}</span> : null}
                      {r.risk ? <span className="badge badge-warn">{t("me.txRisk")}</span> : null}
                      {r.nft ? <span className="badge badge-info">NFT</span> : null}
                    </b>
                    <span>
                      {r.protocol ? <em>{r.protocol}</em> : null}
                      {r.protocol ? " · " : null}
                      {who}
                    </span>
                  </span>
                  <span className="me-tx-flows">
                    {r.flows.length === 0 ? <span className="num">—</span> : null}
                    {r.flows.map((f, i) => (
                      <span key={`${f.symbol}:${f.dir}:${i}`} className={`me-tx-flow is-${f.dir}`}>
                        <img src={f.icon} alt="" width={16} height={16} />
                        {f.dir === "out" ? "−" : "+"}
                        {f.amount} {f.symbol}
                      </span>
                    ))}
                  </span>
                  <span className="me-tx-gas num">{r.gas || ""}</span>
                </button>
                {expanded ? (
                  <div className="me-tx-more">
                    {detailing && !extra[r.id] ? <p className="me-tx-hint">{t("me.txDetail")}</p> : null}
                    <dl className="me-tx-kv">
                      <div>
                        <dt>{t("me.txTime")}</dt>
                        <dd>{absTime(r.ts) || "—"}</dd>
                      </div>
                      <div>
                        <dt>{t("me.txFrom")}</dt>
                        <dd>
                          <Party
                            chainId={r.chainId}
                            addr={r.from}
                            label={r.fromLabel}
                            ours={r.ours}
                            copied={copied}
                            onPeek={peekAddr}
                            onCopy={copy}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt>{t("me.txTo")}</dt>
                        <dd>
                          <Party
                            chainId={r.chainId}
                            addr={r.to}
                            label={r.toLabel || r.protocol}
                            ours={r.ours}
                            copied={copied}
                            onPeek={peekAddr}
                            onCopy={copy}
                          />
                        </dd>
                      </div>
                      {r.flows.map((f, i) => (
                        <div key={`f-${f.symbol}-${i}`}>
                          <dt>{f.dir === "in" ? t("me.txKind.in") : t("me.txKind.out")}</dt>
                          <dd>
                            <span className={`me-tx-flow is-${f.dir}`}>
                              {f.dir === "out" ? "−" : "+"}
                              {f.amount} {f.symbol}
                            </span>
                            {f.token ? <span className="me-tx-mini">{t("me.txToken")} {shortAddr(k, f.token)}</span> : null}
                            {f.counter && canFollow(r.ours, f.counter) ? (
                              <button type="button" className="me-tx-link" onClick={() => peekAddr(r.chainId, f.counter!, f.symbol)}>
                                {t("me.txFollow")} {shortAddr(k, f.counter)}
                              </button>
                            ) : null}
                          </dd>
                        </div>
                      ))}
                      <div>
                        <dt>{t("me.txHash")}</dt>
                        <dd>
                          <span className="num">{clipHash(r.hash)}</span>
                          <button type="button" className="me-tx-link" onClick={() => copy(r.hash, `h:${r.id}`)}>
                            {copied === `h:${r.id}` ? t("me.txCopied") : t("me.txCopy")}
                          </button>
                        </dd>
                      </div>
                      {r.gas ? (
                        <div>
                          <dt>{t("me.txGas")}</dt>
                          <dd className="num">{r.gas}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <div className="me-tx-acts">
                      {r.explorer ? (
                        <a href={r.explorer} target="_blank" rel="noreferrer" className="me-pool-btn me-pool-btn-explore">
                          {t("me.txExplore")}
                        </a>
                      ) : null}
                      {canFollow(r.ours, r.peer) ? (
                        <button type="button" className="me-pool-btn me-pool-btn-dex" onClick={() => peekAddr(r.chainId, r.peer, r.protocol)}>
                          {t("me.txFollow")} · {r.protocol || shortAddr(k, r.peer)}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Party({
  chainId,
  addr,
  label,
  ours,
  copied,
  onPeek,
  onCopy,
}: {
  chainId: number;
  addr: string;
  label?: string;
  ours: string;
  copied: string;
  onPeek: (chainId: number, value: string, label?: string) => void;
  onCopy: (text: string, id: string) => void;
}) {
  const { t } = useTranslation();
  if (!addr) return <span>—</span>;
  if (isZeroAddr(addr)) return <span>{t("me.txZero")}</span>;
  const k = kindOfChain(chainId);
  const mine = addr.toLowerCase() === ours.toLowerCase();
  const id = `a:${chainId}:${addr}`;
  const short = shortAddr(k, addr);
  return (
    <span className="me-tx-party">
      <b>{label || short}</b>
      {mine ? <em>{t("me.txOurs")}</em> : label ? <span className="num">{short}</span> : null}
      {canFollow(ours, addr) ? (
        <button type="button" className="me-tx-link" onClick={() => onPeek(chainId, addr, label)}>
          {t("me.txFollow")}
        </button>
      ) : null}
      <button type="button" className="me-tx-link" onClick={() => onCopy(addr, id)}>
        {copied === id ? t("me.txCopied") : t("me.txCopyAddr")}
      </button>
    </span>
  );
}
