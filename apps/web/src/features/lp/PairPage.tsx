import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createPublicClient, http, type PublicClient } from "viem";
import { useAccount } from "wagmi";
import { CHAINS } from "@ysk-mint/config";
import { seedToken, isStable } from "../../lib/dexVenues.ts";
import { readVenuesForPair, weightedPrice, type VenuePool } from "../../lib/dexPools.ts";
import { usePairSwaps } from "../../lib/usePairSwaps.ts";
import { fmtUsdc } from "../../lib/defiQuotes.ts";
import { canonAddr } from "../../lib/pairKey.ts";

function short(a: string) {
  if (!a || a.length < 12) return a || "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function PairPage() {
  const { t } = useTranslation();
  const { chainId: cid, tokenA, tokenB } = useParams();
  const chainId = Number(cid);
  const a = tokenA as `0x${string}`;
  const b = tokenB as `0x${string}`;
  const chain = Object.values(CHAINS).find((c) => c.chainId === chainId);
  const sa = seedToken(chainId, a);
  const sb = seedToken(chainId, b);
  const { address } = useAccount();
  const [venues, setVenues] = useState<VenuePool[]>([]);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<PublicClient | undefined>();

  useEffect(() => {
    if (!chain?.rpc || !a || !b || !Number.isFinite(chainId)) return;
    const fallback: Record<number, string> = {
      1: "https://ethereum-rpc.publicnode.com",
      8453: "https://base.publicnode.com",
      42161: "https://arbitrum-one-rpc.publicnode.com",
      56: "https://bsc-rpc.publicnode.com",
      43114: "https://avalanche-c-chain-rpc.publicnode.com",
    };
    const c = createPublicClient({ transport: http(fallback[chainId] ?? chain.rpc) });
    setClient(c);
    let cancelled = false;
    setLoading(true);
    void readVenuesForPair(c, chainId, canonAddr(a), canonAddr(b), sa?.decimals ?? 18, sb?.decimals ?? 18)
      .then((v) => {
        if (!cancelled) setVenues(v);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [a, b, chain, chainId, sa?.decimals, sb?.decimals]);

  const price = useMemo(() => weightedPrice(venues), [venues]);
  const swaps = usePairSwaps(client, venues, sa?.decimals ?? 18, sb?.decimals ?? 18);
  const quoteIsStable = sb ? isStable(sb.symbol) : false;

  if (!a || !b || !Number.isFinite(chainId)) return <p className="workspace-scroll">{t("lp.pairMissing")}</p>;

  const title = `${sa?.symbol ?? short(a)} / ${sb?.symbol ?? short(b)}`;

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">
            <Link to="/">{t("nav.lp")}</Link>
            {" · "}
            {chain?.short ?? chainId}
          </p>
          <h1>{title}</h1>
          <p className="mt-1 text-[15px] text-text-sub">{t("lp.oracleNote")}</p>
        </div>
        <div className="me-summary">
          <b>{price == null ? "—" : `${fmtUsdc(price)} ${quoteIsStable ? sb?.symbol : ""}`}</b>
          <span>{t("lp.oracle", { n: venues.length })}</span>
        </div>
      </div>
      <div className="workspace-scroll">
        <div className="me-desk">
          <section className="me-card">
            <div className="me-card-head">
              <b>{t("lp.venues")}</b>
              <span className="me-count">{loading ? "…" : venues.length}</span>
            </div>
            {loading ? (
              <p className="me-card-empty">{t("lp.loading")}</p>
            ) : venues.length === 0 ? (
              <p className="me-card-empty">{t("lp.noVenues")}</p>
            ) : (
              <div className="me-list">
                {venues.map((v) => (
                  <a
                    key={`${v.venue.id}-${v.pool}-${v.feeLabel}`}
                    className="me-token me-token-5"
                    href={`${chain?.explorer}/address/${v.pool}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="holding-ico-wrap">
                      <img src={sa?.icon ?? "/tokens/eth.png"} alt="" className="holding-ico" />
                    </span>
                    <div className="holding-meta">
                      <b>
                        {v.venue.name} · {v.feeLabel}
                      </b>
                      <span className="num">{short(v.pool)}</span>
                    </div>
                    <span className="num me-price">{fmtUsdc(v.priceAinB)}</span>
                    <span className="num holding-amt">{v.reserveA ? v.reserveA.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}</span>
                    <span className="num me-value">{v.tvlQuote ? fmtUsdc(v.tvlQuote) : "—"}</span>
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="me-card">
            <div className="me-card-head">
              <b>{t("lp.trades")}</b>
              <span className="me-count">{swaps.loading ? "…" : swaps.rows.length}</span>
            </div>
            {swaps.loading ? (
              <p className="me-card-empty">{t("lp.loading")}</p>
            ) : swaps.rows.length === 0 ? (
              <p className="me-card-empty">{t("lp.noTrades")}</p>
            ) : (
              <div className="me-list">
                {swaps.rows.map((s) => (
                  <div key={s.id} className="me-token me-token-5">
                    <span className="holding-ico-wrap">
                      <span className="holding-ico me-oft-mark">{s.side === "buy0" ? "B" : "S"}</span>
                    </span>
                    <div className="holding-meta">
                      <b>{s.venue}</b>
                      <span className="num">#{s.block.toString()}</span>
                    </div>
                    <span className="num me-price">{Number(s.amount0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                    <span className="num holding-amt">{Number(s.amount1).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                    <span className="num me-value">{short(s.pool)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {address ? <p className="field-note">{t("lp.myLpHint")}</p> : <p className="field-note">{t("lp.connectForLp")}</p>}
        </div>
      </div>
    </section>
  );
}
