import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createPublicClient, http, type PublicClient } from "viem";
import { useAccount } from "wagmi";
import { CHAINS } from "@ysk-mint/config";
import { seedToken, isStable } from "../../lib/dexVenues.ts";
import { readVenuesForPair, weightedPrice, type VenuePool } from "../../lib/dexPools.ts";
import { usePairSwaps } from "../../lib/usePairSwaps.ts";
import { trackLive, useLiveStatus } from "../../lib/liveStatus.ts";
import { fmtCompact, fmtUsdc } from "../../lib/defiQuotes.ts";
import { canonAddr } from "../../lib/pairKey.ts";
import { nearToken, nearVenuesForPair } from "../../lib/nearDex.ts";
import { adaTokenMeta, adaVenuesForPair } from "../../lib/adaDex.ts";

function short(a: string) {
  if (!a || a.length < 12) return a || "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function PairPage() {
  const { t } = useTranslation();
  const { chainId: cid, tokenA, tokenB } = useParams();
  const chainId = Number(cid);
  const a = decodeURIComponent(tokenA || "");
  const b = decodeURIComponent(tokenB || "");
  const chain = Object.values(CHAINS).find((c) => c.chainId === chainId);
  const sa = seedToken(chainId, a) ?? nearToken(a) ?? adaTokenMeta(a);
  const sb = seedToken(chainId, b) ?? nearToken(b) ?? adaTokenMeta(b);
  const { address } = useAccount();
  const [venues, setVenues] = useState<VenuePool[]>([]);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<PublicClient | undefined>();

  useEffect(() => {
    if (!a || !b || !Number.isFinite(chainId)) return;
    let cancelled = false;
    setLoading(true);
    const run = async () => {
      if (chain?.vm === "near") {
        setClient(undefined);
        return nearVenuesForPair(a, b);
      }
      if (chain?.vm === "cardano") {
        setClient(undefined);
        return adaVenuesForPair(a, b, sa?.decimals ?? 6, sb?.decimals ?? 6);
      }
      if (!chain?.rpc) return [];
      const fallback: Record<number, string> = {
        1: "https://ethereum-rpc.publicnode.com",
        8453: "https://base.publicnode.com",
        42161: "https://arbitrum-one-rpc.publicnode.com",
        56: "https://bsc-rpc.publicnode.com",
        43114: "https://avalanche-c-chain-rpc.publicnode.com",
      };
      const c = createPublicClient({ transport: http(fallback[chainId] ?? chain.rpc) });
      setClient(c);
      return readVenuesForPair(c, chainId, canonAddr(a), canonAddr(b), sa?.decimals ?? 18, sb?.decimals ?? 18);
    };
    void trackLive(`pair:${chainId}`, chainId, "markets", run)
      .then((v) => {
        if (!cancelled) setVenues(v);
      })
      .catch(() => {
        if (!cancelled) setVenues([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      useLiveStatus.getState().finish(`pair:${chainId}`, true);
    };
  }, [a, b, chain, chainId, sa?.decimals, sb?.decimals]);

  const price = useMemo(() => weightedPrice(venues), [venues]);
  const evm = chain?.vm === "evm" || chain?.evm;
  const swaps = usePairSwaps(evm ? client : undefined, evm ? venues : [], sa?.decimals ?? 18, sb?.decimals ?? 18, chainId);
  const quoteIsStable = sb ? isStable(sb.symbol) : false;

  function venueHref(pool: string) {
    if (chain?.vm === "near") return "https://nearblocks.io/address/v2.ref-finance.near";
    if (chain?.vm === "cardano") {
      const unit = pool.replace(".", "");
      if (/^[0-9a-f]{56,}$/i.test(unit)) return `${chain.explorer}/token/${unit}`;
      return chain.explorer;
    }
    return chain?.explorer ? `${chain.explorer}/address/${pool}` : undefined;
  }

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
                <div className="me-cols me-cols-5">
                  <span>{t("lp.venues")}</span>
                  <span>{t("me.quote")}</span>
                  <span>{sa?.symbol ?? "A"}</span>
                  <span>{t("lp.depth")}</span>
                </div>
                {venues.map((v) => (
                  <a
                    key={`${v.venue.id}-${v.pool}-${v.feeLabel}`}
                    className="me-token me-token-5"
                    href={venueHref(v.pool)}
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
                    <span className="num me-price">{fmtCompact(v.priceAinB)}</span>
                    <span className="num holding-amt">{v.reserveA ? fmtCompact(v.reserveA) : "—"}</span>
                    <span className="num me-value">{v.tvlQuote ? fmtCompact(v.tvlQuote) : "—"}</span>
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
              <p className="me-card-empty">{evm ? t("lp.noTrades") : t("lp.noOnchainTrades")}</p>
            ) : (
              <div className="me-list">
                <div className="me-cols me-cols-5">
                  <span>{t("lp.trades")}</span>
                  <span>{sa?.symbol ?? "A"}</span>
                  <span>{sb?.symbol ?? "B"}</span>
                  <span />
                </div>
                {swaps.rows.map((s) => {
                  const href = s.tx && chain?.explorer ? `${chain.explorer}/tx/${s.tx}` : undefined;
                  const inner = (
                    <>
                      <span className="holding-ico-wrap">
                        <span className="holding-ico me-oft-mark">{s.side === "buy0" ? "B" : "S"}</span>
                      </span>
                      <div className="holding-meta">
                        <b>{s.venue}</b>
                        <span className="num">#{s.block.toString()}</span>
                      </div>
                      <span className="num me-price">{fmtCompact(s.amount0)}</span>
                      <span className="num holding-amt">{fmtCompact(s.amount1)}</span>
                      <span className="num me-value">{href ? t("lp.open") : ""}</span>
                    </>
                  );
                  return href ? (
                    <a key={s.id} href={href} target="_blank" rel="noreferrer" className="me-token me-token-5">
                      {inner}
                    </a>
                  ) : (
                    <div key={s.id} className="me-token me-token-5">
                      {inner}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {address ? <p className="field-note">{t("lp.myLpHint")}</p> : <p className="field-note">{t("lp.connectForLp")}</p>}
        </div>
      </div>
    </section>
  );
}
