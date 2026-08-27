import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { type PublicClient } from "viem";
import { useAccount } from "wagmi";
import { CHAINS } from "@ysk-mint/config";
import { seedToken, isStable } from "../../lib/dexVenues.ts";
import { evmPublicClient } from "../../lib/defi/evm/client.ts";
import { erc20MetaAbi } from "../../lib/defi/evm/abis.ts";
import { readVenuesForPair, venueQuotesToPools, weightedPrice, type VenuePool } from "../../lib/dexPools.ts";
import { cacheGet, cacheKey, cacheLastGood, cacheReady, onVisibleInterval, POLICIES } from "../../lib/defi/cache.ts";
import type { VenueQuote } from "../../lib/defi/types.ts";
import { usePairSwaps, type SwapRow } from "../../lib/usePairSwaps.ts";
import { cancelLive, trackLive } from "../../lib/liveStatus.ts";
import { fmtCompact, fmtUsdc } from "../../lib/defiQuotes.ts";
import { asAddr, canonAddr, pairId } from "../../lib/pairKey.ts";
import { TOKEN_CATALOG } from "../../lib/tokenRegistry.ts";
import { nearToken, nearVenuesForPair } from "../../lib/nearDex.ts";
import { adaTokenMeta, adaVenuesForPair } from "../../lib/adaDex.ts";
import { SortHead, useSort } from "../../shared/ui/SortTable.tsx";
import { marketsHref } from "./LpPage.tsx";

type TokenMeta = { symbol: string; decimals: number; icon: string };

async function evmTokenMeta(client: PublicClient, chainId: number, address: string, hint?: { symbol?: string; decimals?: number; icon?: string }): Promise<TokenMeta> {
  const hit = TOKEN_CATALOG.find((t) => t.chainId === chainId && t.address?.toLowerCase() === address.toLowerCase());
  const icon = hit?.icon ?? hint?.icon ?? "/tokens/eth.png";
  if (hit?.symbol && hit.decimals) return { symbol: hit.symbol, decimals: hit.decimals, icon };
  if (hint?.symbol && hint.decimals) return { symbol: hint.symbol, decimals: hint.decimals, icon };
  if (!address.startsWith("0x") && !address.startsWith("0X")) {
    return { symbol: hint?.symbol ?? short(address), decimals: hint?.decimals ?? 18, icon };
  }
  try {
    return await cacheGet(
      {
        key: cacheKey("meta.erc20", chainId, canonAddr(address)),
        policy: { ...POLICIES.meta, keep: (m: TokenMeta) => Boolean(m.symbol) },
      },
      async () => {
        const [decimals, symbol] = await Promise.all([
          client.readContract({ address: asAddr(address), abi: erc20MetaAbi, functionName: "decimals" }),
          client.readContract({ address: asAddr(address), abi: erc20MetaAbi, functionName: "symbol" }).catch(() => ""),
        ]);
        const sym = String(symbol || "").trim();
        return { symbol: sym || short(address), decimals: Number(decimals) || 18, icon };
      },
    );
  } catch {
    return { symbol: hint?.symbol ?? short(address), decimals: hint?.decimals ?? 18, icon };
  }
}

function fmtTradeTime(ts: number | undefined, t: (key: string, opts?: { n: number }) => string) {
  if (!ts) return "";
  const sec = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (sec < 60) return t("lp.agoSec", { n: sec });
  if (sec < 3600) return t("lp.agoMin", { n: Math.floor(sec / 60) });
  if (sec < 86400) return t("lp.agoHour", { n: Math.floor(sec / 3600) });
  return t("lp.agoDay", { n: Math.floor(sec / 86400) });
}

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
  const [metaA, setMetaA] = useState<TokenMeta>({ symbol: sa?.symbol ?? short(a), decimals: sa?.decimals ?? 18, icon: sa?.icon ?? "/tokens/eth.png" });
  const [metaB, setMetaB] = useState<TokenMeta>({ symbol: sb?.symbol ?? short(b), decimals: sb?.decimals ?? 18, icon: sb?.icon ?? "/tokens/eth.png" });

  useEffect(() => {
    if (!a || !b || !Number.isFinite(chainId)) return;
    let cancelled = false;
    const venuesKey = cacheKey("venues", pairId(chainId, a, b));
    const seed = cacheLastGood<VenueQuote[]>(venuesKey);
    if (seed?.length) {
      setVenues(venueQuotesToPools(seed));
      setLoading(false);
    } else {
      setLoading(true);
    }
    const run = async () => {
      await cacheReady();

      if (chain?.vm === "near") {
        setClient(undefined);
        return nearVenuesForPair(a, b);
      }
      if (chain?.vm === "cardano") {
        setClient(undefined);
        return adaVenuesForPair(a, b, sa?.decimals ?? 6, sb?.decimals ?? 6);
      }
      const c = evmPublicClient(chainId);
      if (!c) return [];
      setClient(c);
      const [ma, mb] = await Promise.all([evmTokenMeta(c, chainId, a, sa), evmTokenMeta(c, chainId, b, sb)]);
      if (!cancelled) {
        setMetaA(ma);
        setMetaB(mb);
      }
      return readVenuesForPair(c, chainId, canonAddr(a), canonAddr(b), ma.decimals, mb.decimals);
    };
    void trackLive(`pair:${chainId}`, chainId, "markets", run)
      .then((v) => {
        if (!cancelled && v.length) setVenues(v);
      })
      .catch(() => {
        if (!cancelled && !seed?.length) setVenues([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const stop = onVisibleInterval(60_000, () => {
      if (cancelled) return;
      void trackLive(`pair:${chainId}`, chainId, "markets", run)
        .then((v) => {
          if (!cancelled && v.length) setVenues(v);
        })
        .catch(() => undefined);
    });
    return () => {
      cancelled = true;
      stop();
      cancelLive(`pair:${chainId}`);
    };
  }, [a, b, chain, chainId, sa?.decimals, sb?.decimals]);

  const price = useMemo(() => weightedPrice(venues), [venues]);
  const evm = chain?.vm === "evm" || chain?.evm;
  const swaps = usePairSwaps(evm ? client : undefined, evm ? venues : [], a, metaA.decimals, metaB.decimals, chainId);
  const venueGet = useCallback((v: VenuePool, k: string) => {
    if (k === "name") return v.venue.name;
    if (k === "quote") return v.priceAinB;
    if (k === "amount") return v.reserveA;
    return v.tvlQuote;
  }, []);
  const venueSort = useSort(venues, "depth", venueGet);
  const tradeGet = useCallback((s: SwapRow, k: string) => {
    if (k === "name") return s.venue;
    if (k === "a") return s.amountA;
    if (k === "b") return s.amountB;
    if (k === "price") return s.price;
    return s.ts ?? Number(s.block);
  }, []);
  const tradeSort = useSort(swaps.rows, "time", tradeGet);
  const quoteIsStable = isStable(metaB.symbol);

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

  const title = `${metaA.symbol} / ${metaB.symbol}`;

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">
            <Link to={marketsHref()}>{t("nav.lp")}</Link>
            {" · "}
            {chain?.short ?? chainId}
          </p>
          <h1>{title}</h1>
          <p className="mt-1 text-[15px] text-text-sub">{t("lp.oracleNote")}</p>
        </div>
        <div className="me-summary">
          <b>{price == null ? "—" : `${fmtUsdc(price)} ${quoteIsStable ? metaB.symbol : ""}`}</b>
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
                  <SortHead id="name" label={t("lp.venues")} active={venueSort.key === "name"} dir={venueSort.dir} onToggle={venueSort.toggle} align="left" />
                  <SortHead id="quote" label={t("me.quote")} active={venueSort.key === "quote"} dir={venueSort.dir} onToggle={venueSort.toggle} />
                  <SortHead id="amount" label={metaA.symbol} active={venueSort.key === "amount"} dir={venueSort.dir} onToggle={venueSort.toggle} />
                  <SortHead id="depth" label={t("lp.depth")} active={venueSort.key === "depth"} dir={venueSort.dir} onToggle={venueSort.toggle} />
                </div>
                {venueSort.sorted.map((v) => (
                  <a
                    key={`${v.venue.id}-${v.pool}-${v.feeLabel}`}
                    className="me-token me-token-5"
                    href={venueHref(v.pool)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="holding-ico-wrap">
                      <img src={metaA.icon} alt="" className="holding-ico" />
                    </span>
                    <div className="holding-meta">
                      <b>
                        {v.venue.name} · {v.feeLabel}
                      </b>
                      <span className="num">{short(v.pool)}</span>
                    </div>
                    <span className="num me-price">{fmtCompact(v.priceAinB)}</span>
                    <span className="num holding-amt">{v.reserveA > 0 ? fmtCompact(v.reserveA) : "—"}</span>
                    <span className="num me-value">{v.tvlQuote > 0 ? fmtCompact(v.tvlQuote) : "—"}</span>
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
            {swaps.loading || loading ? (
              <p className="me-card-empty">{t("lp.loading")}</p>
            ) : swaps.rows.length === 0 ? (
              <p className="me-card-empty">{swaps.rpcError ? t("lp.tradesRpc") : evm ? t("lp.noTrades") : t("lp.noOnchainTrades")}</p>
            ) : (
              <div className="me-list">
                <div className="me-cols me-cols-5">
                  <SortHead id="time" label={t("lp.time")} active={tradeSort.key === "time"} dir={tradeSort.dir} onToggle={tradeSort.toggle} align="left" />
                  <SortHead id="a" label={metaA.symbol} active={tradeSort.key === "a"} dir={tradeSort.dir} onToggle={tradeSort.toggle} />
                  <SortHead id="b" label={metaB.symbol} active={tradeSort.key === "b"} dir={tradeSort.dir} onToggle={tradeSort.toggle} />
                  <SortHead id="price" label={t("lp.price")} active={tradeSort.key === "price"} dir={tradeSort.dir} onToggle={tradeSort.toggle} />
                </div>
                {tradeSort.sorted.map((s) => {
                  const href = s.tx && chain?.explorer ? `${chain.explorer}/tx/${s.tx}` : undefined;
                  const when = fmtTradeTime(s.ts, t);
                  const inner = (
                    <>
                      <span className="holding-ico-wrap">
                        <span
                          className={`holding-ico me-oft-mark ${s.side === "buy" ? "me-trade-buy" : "me-trade-sell"}`}
                          title={s.side === "buy" ? t("lp.tradeBuy") : t("lp.tradeSell")}
                        >
                          {s.side === "buy" ? t("lp.tradeBuyMark") : t("lp.tradeSellMark")}
                        </span>
                      </span>
                      <div className="holding-meta">
                        <b>{s.venue}</b>
                        <span
                          className="num"
                          title={s.ts ? `${new Date(s.ts * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC` : undefined}
                        >
                          {when}
                          {when ? " · " : ""}#{s.block.toString()}
                          {s.tx ? ` · ${short(s.tx)}` : ""}
                        </span>
                      </div>
                      <span className="num me-price">{fmtCompact(s.amountA)}</span>
                      <span className="num holding-amt">{fmtCompact(s.amountB)}</span>
                      <span className="num me-value">{s.price == null ? "—" : fmtCompact(s.price)}</span>
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
