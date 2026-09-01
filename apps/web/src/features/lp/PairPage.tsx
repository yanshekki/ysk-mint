import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LocaleLink as Link } from "../../app/LocaleLink.tsx";
import { localePath } from "../../lib/locale.ts";
import { useSeoExtra } from "../../lib/seo.ts";
import { useTranslation } from "react-i18next";
import { type PublicClient } from "viem";
import { useAccount } from "wagmi";
import { CHAINS } from "@ysk-mint/config";
import { seedToken } from "../../lib/dexVenues.ts";
import { evmPublicClient } from "../../lib/defi/evm/client.ts";
import { erc20MetaAbi } from "../../lib/defi/evm/abis.ts";
import { readVenuesForPair, venueQuotesToPools, weightedPrice, type VenuePool } from "../../lib/dexPools.ts";
import { cacheGet, cacheKey, cacheLastGood, cacheReady, onVisibleInterval, POLICIES } from "../../lib/defi/cache.ts";
import { venueDisplayDepth, pairPriceUsd, VENUES_CACHE } from "../../lib/defi/quote.ts";
import type { VenueQuote } from "../../lib/defi/types.ts";
import { TRADE_TABLE_ROWS, usePairSwaps, type SwapRow } from "../../lib/usePairSwaps.ts";
import { usePoolOhlcv } from "../../lib/poolOhlcv.ts";
import { PairTradeChart } from "./PairChart.tsx";
import { cancelLive, trackLive } from "../../lib/liveStatus.ts";
import { fmtCompact, fmtDepthUsd, fmtQuoteUsd, fmtReserveAmt } from "../../lib/defiQuotes.ts";
import { asAddr, canonAddr, pairId } from "../../lib/pairKey.ts";
import { displayStableSymbol, orientPair } from "../../lib/pairOrient.ts";
import { chainIcon } from "../../lib/chainIcon.ts";
import { TOKEN_CATALOG } from "../../lib/tokenRegistry.ts";
import { looksLikeContractLabel, resolveTokenMeta, type TokenMeta } from "../../lib/tokenLabel.ts";
import { nearFtMeta, nearToken } from "../../lib/nearDex.ts";
import { adaTokenMeta } from "../../lib/adaDex.ts";
import { cachedMarketPairMeta, cachedMarketPairQuotes, nativePairVenues } from "../../lib/nativePairVenues.ts";
import { SortHead, useSort } from "../../shared/ui/SortTable.tsx";
import { Metric } from "../../shared/ui/Metric.tsx";
import { marketsHref } from "./LpPage.tsx";
import { stocksHref } from "../stocks/StocksPage.tsx";
import { isTokenizedUsEquityPair } from "../../lib/usEquity.ts";
import { dexAppHref } from "../../lib/dexApp.ts";

async function evmTokenMeta(client: PublicClient, chainId: number, address: string, hint?: { symbol?: string; decimals?: number; icon?: string }): Promise<TokenMeta> {
  const seeded = resolveTokenMeta(chainId, address, hint);
  if (!looksLikeContractLabel(seeded.symbol) && seeded.decimals) {
    if (!address.startsWith("0x") && !address.startsWith("0X")) return seeded;
    if (TOKEN_CATALOG.find((t) => t.chainId === chainId && t.address?.toLowerCase() === address.toLowerCase())) return seeded;
    if (hint?.symbol && hint.decimals) return seeded;
  }
  if (!address.startsWith("0x") && !address.startsWith("0X")) return seeded;
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
        const sym = displayStableSymbol(chainId, address, String(symbol || "").trim());
        return resolveTokenMeta(chainId, address, {
          symbol: looksLikeContractLabel(sym) ? seeded.symbol : sym,
          decimals: Number(decimals) || seeded.decimals,
          icon: seeded.icon,
        });
      },
    );
  } catch {
    return seeded;
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
  const nav = useNavigate();
  const { chainId: cid, tokenA, tokenB } = useParams();
  const chainId = Number(cid);
  const a = decodeURIComponent(tokenA || "");
  const b = decodeURIComponent(tokenB || "");
  const chain = Object.values(CHAINS).find((c) => c.chainId === chainId);
  const sa = seedToken(chainId, a) ?? nearToken(a) ?? adaTokenMeta(a);
  const sb = seedToken(chainId, b) ?? nearToken(b) ?? adaTokenMeta(b);
  const oriented = Number.isFinite(chainId) && a && b ? orientPair(chainId, a, b, sa?.symbol, sb?.symbol) : { base: a, quote: b, flipped: false };
  const base = oriented.base;
  const quote = oriented.quote;
  const leftSeed = oriented.flipped ? sb : sa;
  const rightSeed = oriented.flipped ? sa : sb;
  const { address } = useAccount();
  const marketMeta = Number.isFinite(chainId) && base && quote ? cachedMarketPairMeta(chainId, base, quote) : undefined;
  const leftHint = {
    symbol: marketMeta?.symbolA ?? leftSeed?.symbol,
    decimals: leftSeed?.decimals,
    icon: marketMeta?.iconA ?? leftSeed?.icon,
  };
  const rightHint = {
    symbol: marketMeta?.symbolB ?? rightSeed?.symbol,
    decimals: rightSeed?.decimals,
    icon: marketMeta?.iconB ?? rightSeed?.icon,
  };
  const [venues, setVenues] = useState<VenuePool[]>([]);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<PublicClient | undefined>();
  const [metaA, setMetaA] = useState<TokenMeta>(() => resolveTokenMeta(chainId, base, leftHint));
  const [metaB, setMetaB] = useState<TokenMeta>(() => resolveTokenMeta(chainId, quote, rightHint));

  useEffect(() => {
    if (!oriented.flipped || !base || !quote || !Number.isFinite(chainId)) return;
    nav(localePath(`/pair/${chainId}/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`), { replace: true });
  }, [base, chainId, nav, oriented.flipped, quote]);

  useEffect(() => {
    if (!base || !quote || !Number.isFinite(chainId)) return;
    let cancelled = false;
    const venuesKey = cacheKey(VENUES_CACHE, pairId(chainId, base, quote), "base", base.toLowerCase());
    const seed = cacheLastGood<VenueQuote[]>(venuesKey);
    const fromList = cachedMarketPairQuotes(chainId, base, quote);
    const pairMeta = cachedMarketPairMeta(chainId, base, quote);
    if (pairMeta) {
      setMetaA(resolveTokenMeta(chainId, base, { symbol: pairMeta.symbolA, icon: pairMeta.iconA, decimals: leftSeed?.decimals }));
      setMetaB(resolveTokenMeta(chainId, quote, { symbol: pairMeta.symbolB, icon: pairMeta.iconB, decimals: rightSeed?.decimals }));
    }
    if (fromList.length || seed?.length) {
      const seen = new Set<string>();
      const merged: VenueQuote[] = [];
      for (const q of [...fromList, ...(seed ?? [])]) {
        const k = `${q.protocolId}:${(q.pool || "").toLowerCase()}`;
        if (seen.has(k)) continue;
        seen.add(k);
        merged.push(q);
      }
      setVenues(venueQuotesToPools(merged));
      setLoading(false);
    } else {
      setLoading(true);
    }
    const run = async () => {
      await cacheReady();

      if (chain?.vm && chain.vm !== "evm") {
        setClient(undefined);
        if (chain.vm === "near") {
          const [ma, mb] = await Promise.all([nearFtMeta(base), nearFtMeta(quote)]);
          if (!cancelled) {
            setMetaA(resolveTokenMeta(chainId, base, { symbol: ma.symbol, decimals: ma.decimals, icon: ma.icon }));
            setMetaB(resolveTokenMeta(chainId, quote, { symbol: mb.symbol, decimals: mb.decimals, icon: mb.icon }));
          }
        } else {
          const hit = cachedMarketPairMeta(chainId, base, quote);
          if (!cancelled && hit) {
            setMetaA(resolveTokenMeta(chainId, base, { symbol: hit.symbolA, icon: hit.iconA, decimals: leftSeed?.decimals }));
            setMetaB(resolveTokenMeta(chainId, quote, { symbol: hit.symbolB, icon: hit.iconB, decimals: rightSeed?.decimals }));
          }
        }
        const pools = await nativePairVenues(chainId, chain.vm, base, quote, leftSeed?.decimals ?? 6, rightSeed?.decimals ?? 6);
        const after = cachedMarketPairMeta(chainId, base, quote);
        if (!cancelled && after) {
          setMetaA(resolveTokenMeta(chainId, base, { symbol: after.symbolA, icon: after.iconA, decimals: leftSeed?.decimals }));
          setMetaB(resolveTokenMeta(chainId, quote, { symbol: after.symbolB, icon: after.iconB, decimals: rightSeed?.decimals }));
        }
        return pools;
      }
      const c = evmPublicClient(chainId);
      if (!c) return [];
      setClient(c);
      const m = cachedMarketPairMeta(chainId, base, quote);
      const [ma, mb] = await Promise.all([
        evmTokenMeta(c, chainId, base, { symbol: m?.symbolA ?? leftSeed?.symbol, decimals: leftSeed?.decimals, icon: m?.iconA ?? leftSeed?.icon }),
        evmTokenMeta(c, chainId, quote, { symbol: m?.symbolB ?? rightSeed?.symbol, decimals: rightSeed?.decimals, icon: m?.iconB ?? rightSeed?.icon }),
      ]);
      if (!cancelled) {
        setMetaA(ma);
        setMetaB(mb);
      }
      return readVenuesForPair(c, chainId, canonAddr(base), canonAddr(quote), ma.decimals, mb.decimals);
    };
    void trackLive(`pair:${chainId}`, chainId, "markets", run)
      .then((v) => {
        if (!cancelled && v.length) {
          setVenues(v);
        }
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
  }, [base, chain, chainId, quote]);

  const price = useMemo(() => {
    const px = weightedPrice(venues);
    return px == null ? null : pairPriceUsd(px, base, quote, chainId);
  }, [venues, base, quote, chainId]);
  const evm = chain?.vm === "evm" || chain?.evm;
  const tape = evm || chainId === 101;
  const swaps = usePairSwaps(evm ? client : undefined, venues, base, metaA.decimals, metaB.decimals, chainId);
  const ohlcv = usePoolOhlcv(chainId, venues, base);
  const tableRows = useMemo(() => swaps.rows.slice(0, TRADE_TABLE_ROWS), [swaps.rows]);
  const venueGet = useCallback((v: VenuePool, k: string) => {
    if (k === "name") return v.venue.name;
    if (k === "quote") return pairPriceUsd(v.priceAinB, base, quote, chainId) ?? 0;
    if (k === "amount") return v.reserveA;
    return venueDisplayDepth(v, base, quote, chainId);
  }, [base, chainId, quote]);
  const venueSort = useSort(venues, "depth", venueGet);
  const tradeGet = useCallback((s: SwapRow, k: string) => {
    if (k === "name") return s.venue;
    if (k === "a") return s.amountA;
    if (k === "b") return s.amountB;
    if (k === "price") return s.price;
    return s.ts ?? Number(s.block);
  }, []);
  const tradeSort = useSort(tableRows, "time", tradeGet);
  const title = `${metaA.symbol} / ${metaB.symbol}`;
  const chainName = chain?.name ?? chain?.short ?? String(chainId);
  const pairReady = Boolean(base && quote && Number.isFinite(chainId) && metaA.symbol && metaB.symbol && metaA.symbol !== "…" && metaB.symbol !== "…");
  useSeoExtra({
    title: pairReady ? t("seo.pairTitle", { pair: title, chain: chainName }) : undefined,
    description: pairReady ? t("seo.pairDesc", { pair: title, chain: chainName }) : undefined,
  });

  function venueHref(pool: string) {
    if (chain?.vm === "near") return "https://nearblocks.io/address/v2.ref-finance.near";
    if (chain?.vm === "cardano") {
      const unit = pool.replace(".", "");
      if (/^[0-9a-f]{56,}$/i.test(unit)) return `${chain.explorer}/token/${unit}`;
      return chain.explorer;
    }
    return chain?.explorer ? `${chain.explorer}/address/${pool}` : undefined;
  }

  if (!base || !quote || !Number.isFinite(chainId)) return <p className="workspace-scroll">{t("lp.pairMissing")}</p>;

  const equityPair = isTokenizedUsEquityPair({
    chainId,
    tokenA: base,
    tokenB: quote,
    symbolA: metaA.symbol,
    symbolB: metaB.symbol,
  });

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">
            <Link to={equityPair ? stocksHref() : marketsHref()}>{t(equityPair ? "nav.stocks" : "nav.lp")}</Link>
            {" · "}
            {chain?.short ?? chainId}
          </p>
          <h1>{title}</h1>
          <p className="mt-1 text-[15px] text-text-sub">{t("lp.oracleNote")}</p>
        </div>
        <div className="me-summary">
          <b>{price == null ? "—" : fmtQuoteUsd(price)}</b>
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
                <div className="me-cols me-cols-5 me-cols-pool">
                  <SortHead id="name" label={t("lp.protocol")} active={venueSort.key === "name"} dir={venueSort.dir} onToggle={venueSort.toggle} align="left" />
                  <SortHead id="quote" label={t("me.quote")} active={venueSort.key === "quote"} dir={venueSort.dir} onToggle={venueSort.toggle} />
                  <SortHead id="amount" label={metaA.symbol} active={venueSort.key === "amount"} dir={venueSort.dir} onToggle={venueSort.toggle} />
                  <SortHead id="depth" label={t("lp.depth")} active={venueSort.key === "depth"} dir={venueSort.dir} onToggle={venueSort.toggle} />
                  <span />
                </div>
                {venueSort.sorted.map((v) => {
                  const explore = venueHref(v.pool);
                  const dex = dexAppHref({
                    name: v.venue.name,
                    protocolId: v.venue.id,
                    chainId,
                    pool: v.pool,
                    tokenA: base,
                    tokenB: quote,
                    kind: v.venue.kind,
                  });
                  return (
                    <div key={`${v.venue.id}-${v.pool}-${v.feeLabel}`} className="me-token me-token-5 me-token-pool">
                      <span className="holding-ico-wrap">
                        <img
                          src={metaA.icon}
                          alt=""
                          className="holding-ico"
                          onError={(e) => {
                            const el = e.currentTarget;
                            if (el.dataset.fb) return;
                            el.dataset.fb = "1";
                            el.src = chain ? chainIcon(chain) : "/tokens/sol.png";
                          }}
                        />
                      </span>
                      <div className="holding-meta">
                        <b>{v.venue.name}</b>
                        <span>
                          {metaA.symbol}/{metaB.symbol}
                          {v.feeLabel ? ` · ${t("lp.fee")} ${v.feeLabel}` : ""}
                        </span>
                        <span className="num">{short(v.pool)}</span>
                      </div>
                      <Metric className="num me-price" label={t("me.quote")}>
                        {fmtQuoteUsd(pairPriceUsd(v.priceAinB, base, quote, chainId))}
                      </Metric>
                      <Metric className="num holding-amt" label={metaA.symbol}>
                        {v.reserveA > 0 ? fmtReserveAmt(v.reserveA) : "—"}
                      </Metric>
                      <Metric className="num me-value" label={t("lp.depth")}>
                        {venueDisplayDepth(v, base, quote, chainId) > 0 ? fmtDepthUsd(venueDisplayDepth(v, base, quote, chainId)) : "—"}
                      </Metric>
                      <span className="me-pool-acts">
                        {explore ? (
                          <a className="me-pool-btn me-pool-btn-explore" href={explore} target="_blank" rel="noreferrer">
                            {t("lp.explorerBtn")}
                          </a>
                        ) : null}
                        {dex ? (
                          <a className="me-pool-btn me-pool-btn-dex" href={dex} target="_blank" rel="noreferrer">
                            {t("lp.dexBtn")}
                          </a>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="me-card">
            <PairTradeChart ohlcv={ohlcv.candles} rows={swaps.rows} waiting={ohlcv.loading} />
            <div className="me-card-head">
              <b>{t("lp.trades")}</b>
              <span className="me-count">{swaps.loading ? "…" : tableRows.length}</span>
            </div>
            {swaps.loading || loading ? (
              <p className="me-card-empty">{t("lp.loading")}</p>
            ) : swaps.rows.length === 0 ? (
              <p className="me-card-empty">{swaps.rpcError ? t("lp.tradesRpc") : tape ? t("lp.noTrades") : t("lp.noOnchainTrades")}</p>
            ) : (
              <div className="me-list">
                <div className="me-cols me-cols-5">
                  <SortHead id="time" label={t("lp.tradeHead")} active={tradeSort.key === "time"} dir={tradeSort.dir} onToggle={tradeSort.toggle} align="left" />
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
                        <b>{s.venueName || s.venue}</b>
                        {s.feeLabel ? (
                          <span className="me-fee">
                            {t("lp.fee")} {s.feeLabel}
                          </span>
                        ) : null}
                        <span
                          className="num"
                          title={s.ts ? `${new Date(s.ts * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC` : undefined}
                        >
                          {when}
                          {when ? " · " : ""}#{s.block.toString()}
                          {s.tx ? ` · ${short(s.tx)}` : ""}
                        </span>
                      </div>
                      <Metric className="num me-price" label={metaA.symbol}>
                        {fmtCompact(s.amountA)}
                      </Metric>
                      <Metric className="num holding-amt" label={metaB.symbol}>
                        {fmtCompact(s.amountB)}
                      </Metric>
                      <Metric className="num me-value" label={t("lp.price")}>
                        {s.price == null ? "—" : fmtCompact(s.price)}
                      </Metric>
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
