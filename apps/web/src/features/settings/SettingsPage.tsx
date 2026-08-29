import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { LOCALES } from "../../lib/i18n.ts";
import { cacheWipe } from "../../lib/defi/cache.ts";
import { listConnected, MAX_ADDRS, MAX_WATCH, useAddressSets } from "../../lib/addressSets.ts";
import { useNativeWallets } from "../../lib/nativeWallets.ts";
import { BUY_GREEN, SELL_RED, useUserSettings, type QuotePriority, type QuoteSide } from "../../lib/userSettings.ts";
import { AddrAddBar, AddrRow } from "./AddrFields.tsx";
import { OutboundFields } from "./OutboundFields.tsx";
import { RpcSettings } from "./RpcSettings.tsx";
import { SetItem, SetToggle } from "./SetControls.tsx";

const TABS = ["display", "addresses", "chains", "data"] as const;
type SettingsTab = (typeof TABS)[number];

function parseTab(hash: string): SettingsTab {
  const id = hash.replace(/^#/, "").toLowerCase();
  if (id === "addresses" || id === "addrs") return "addresses";
  if (id === "chains" || id === "rpc") return "chains";
  if (id === "data") return "data";
  return "display";
}

function tabLabel(tab: SettingsTab) {
  if (tab === "addresses") return "settings.addrs";
  if (tab === "chains") return "settings.chains";
  if (tab === "data") return "settings.data";
  return "settings.display";
}

const DEMO_ICO: Record<string, string> = {
  WAVAX: "/tokens/avax.png",
  USDC: "/tokens/usdc.png",
};

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const loc = useLocation();
  const navigate = useNavigate();
  const tab = parseTab(loc.hash);
  const s = useUserSettings();
  const { address, isConnected } = useAccount();
  const native = useNativeWallets();
  const book = useAddressSets();
  const [wiping, setWiping] = useState(false);
  const [wiped, setWiped] = useState(false);
  const [restored, setRestored] = useState(false);
  const watchAddRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function setTab(next: SettingsTab) {
    const hash = next === "display" ? "" : `#${next}`;
    if (loc.hash === hash) return;
    navigate({ pathname: loc.pathname, search: loc.search, hash }, { replace: true });
  }

  const lng = LOCALES.some((l) => l.id === i18n.language) ? i18n.language : "zh-HK";

  const quoteIsStable = s.quotePriority !== "gas-stable";
  const quoteSym = quoteIsStable ? "USDC" : "WAVAX";
  const baseSym = quoteIsStable ? "WAVAX" : "USDC";
  const quoteRight = s.quoteSide !== "left";
  const leftSym = s.autoOrient ? (quoteRight ? baseSym : quoteSym) : "WAVAX";
  const rightSym = s.autoOrient ? (quoteRight ? quoteSym : baseSym) : "USDC";
  const pairNote = !s.autoOrient
    ? t("settings.pairPreviewOff")
    : s.quoteSide === "left"
      ? t("settings.pairPreviewLeft")
      : t("settings.pairPreviewRight");

  const greenRed = s.buyColor === BUY_GREEN && s.sellColor === SELL_RED;
  const redGreen = s.buyColor === SELL_RED && s.sellColor === BUY_GREEN;
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

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <h1>{t("nav.settings")}</h1>
          <p className="mt-1 text-[15px] text-text-sub">{t("settings.hint")}</p>
        </div>
      </div>
      <div className="workspace-scroll">
        <div className="me-desk">
          <div className="me-desk-tabs" role="tablist">
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`me-chip ${tab === id ? "me-chip-on" : ""}`}
                onClick={() => setTab(id)}
              >
                {t(tabLabel(id))}
              </button>
            ))}
          </div>

          {tab === "display" ? (
            <section className="me-card" role="tabpanel">
              <SetItem title={t("nav.lang")} hint={t("settings.langHint")}>
                <div className="me-chips">
                  {LOCALES.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className={`me-chip ${lng === l.id ? "me-chip-on" : ""}`}
                      onClick={() => void i18n.changeLanguage(l.id)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </SetItem>
              <SetToggle title={t("settings.liveDock")} hint={t("settings.liveDockHint")} on={s.liveDock} onChange={(on) => s.patch({ liveDock: on })} />
              <SetToggle title={t("settings.hideZero")} hint={t("settings.hideZeroHint")} on={s.hideZero} onChange={(on) => s.patch({ hideZero: on })} />
              <div className="me-card-head">
                <b>{t("settings.markets")}</b>
              </div>
              <SetToggle
                title={t("settings.autoOrient")}
                hint={t("settings.autoOrientHint")}
                on={s.autoOrient}
                onChange={(on) => s.patch({ autoOrient: on })}
              />
              <div className={`me-token set-live ${s.autoOrient ? "" : "me-token-zero"}`}>
                <span className="holding-ico-wrap">
                  <img src={DEMO_ICO[leftSym]} alt="" className="holding-ico" />
                  <span className="holding-chain-tag">Avax</span>
                </span>
                <div className="holding-meta">
                  <b>
                    {leftSym} / {rightSym}
                  </b>
                  <span>{pairNote}</span>
                </div>
                {s.autoOrient ? <span className="set-leg is-quote">{quoteSym}</span> : <span className="set-leg">{t("settings.quoteOff")}</span>}
              </div>
              <div className={s.autoOrient ? "" : "set-dim"}>
                <SetItem title={t("settings.quoteSide")} hint={t("settings.quoteSideHint")}>
                  <div className="me-chips">
                    {(["right", "left"] as QuoteSide[]).map((side) => (
                      <button
                        key={side}
                        type="button"
                        className={`me-chip ${s.quoteSide === side ? "me-chip-on" : ""}`}
                        disabled={!s.autoOrient}
                        onClick={() => s.patch({ quoteSide: side })}
                      >
                        {t(side === "right" ? "settings.quoteRight" : "settings.quoteLeft")}
                      </button>
                    ))}
                  </div>
                </SetItem>
                <SetItem title={t("settings.quotePriority")} hint={t("settings.quotePriorityHint")}>
                  <div className="me-chips">
                    {(["stable-gas", "gas-stable"] as QuotePriority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`me-chip ${s.quotePriority === p ? "me-chip-on" : ""}`}
                        disabled={!s.autoOrient}
                        onClick={() => s.patch({ quotePriority: p })}
                      >
                        {t(p === "stable-gas" ? "settings.priStable" : "settings.priGas")}
                      </button>
                    ))}
                  </div>
                </SetItem>
              </div>
              <div className="me-card-head">
                <b>{t("settings.trades")}</b>
              </div>
              <SetItem title={t("settings.presets")} hint={t("settings.presetsHint")}>
                <div className="me-chips">
                  <button
                    type="button"
                    className={`me-chip ${greenRed ? "me-chip-on" : ""}`}
                    onClick={() => s.patch({ buyColor: BUY_GREEN, sellColor: SELL_RED })}
                  >
                    {t("settings.presetGreenRed")}
                  </button>
                  <button
                    type="button"
                    className={`me-chip ${redGreen ? "me-chip-on" : ""}`}
                    onClick={() => s.patch({ buyColor: SELL_RED, sellColor: BUY_GREEN })}
                  >
                    {t("settings.presetRedGreen")}
                  </button>
                </div>
              </SetItem>
              <SetItem title={t("settings.customColors")} hint={t("settings.customColorsHint")}>
                <div className="set-swatches">
                  <label className="set-swatch">
                    <span>{t("lp.tradeBuy")}</span>
                    <i style={{ background: s.buyColor }} />
                    <input type="color" value={s.buyColor} aria-label={t("lp.tradeBuy")} onChange={(e) => s.patch({ buyColor: e.target.value })} />
                  </label>
                  <label className="set-swatch">
                    <span>{t("lp.tradeSell")}</span>
                    <i style={{ background: s.sellColor }} />
                    <input type="color" value={s.sellColor} aria-label={t("lp.tradeSell")} onChange={(e) => s.patch({ sellColor: e.target.value })} />
                  </label>
                </div>
              </SetItem>
            </section>
          ) : null}

          {tab === "addresses" ? (
            <>
              <section className="me-card" id="addresses" role="tabpanel">
                <div className="me-card-head">
                  <b>{t("settings.addrsMine")}</b>
                  <span className="me-count">{t("settings.addrsCount", { n: connected.length + book.mine.length })}</span>
                </div>
                <p className="set-note set-note-pad">{t("settings.addrsMineHint")}</p>
                {connected.length ? (
                  <div className="me-list">
                    {connected.map((a) => (
                      <AddrRow key={a.id} addr={a} connected />
                    ))}
                  </div>
                ) : null}
                {book.mine.length ? (
                  <div className="me-list">
                    {book.mine.map((a) => (
                      <AddrRow key={a.id} addr={a} onRemove={() => book.removeMine(a.id)} />
                    ))}
                  </div>
                ) : null}
                {!connected.length && !book.mine.length ? <p className="me-card-empty">{t("settings.addrsMineEmpty")}</p> : null}
                <AddrAddBar disabled={book.mine.length >= MAX_ADDRS} onAdd={(kind, value) => book.addMine(kind, value)} />
              </section>
              <section className="me-card">
                <div className="me-card-head">
                  <b>{t("settings.addrsWatch")}</b>
                  <span className="me-count">{t("settings.watchCount", { n: book.watch.length, max: MAX_WATCH })}</span>
                </div>
                <p className="set-note set-note-pad">{t("settings.addrsWatchHint")}</p>
                {book.watch.map((set) => (
                  <div key={set.id} className="set-watch-block">
                    <div className="me-card-head">
                      <input
                        className="addr-name"
                        defaultValue={set.name}
                        aria-label={t("settings.watchName")}
                        onBlur={(e) => book.renameWatch(set.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                      />
                      <span className="me-count">{t("settings.addrsCount", { n: set.addresses.length })}</span>
                      <button type="button" className="me-pool-btn me-pool-btn-explore" onClick={() => book.removeWatch(set.id)}>
                        {t("settings.watchRemove")}
                      </button>
                    </div>
                    <AddrAddBar
                      addLabel={t("settings.addrAddToSet")}
                      hint={t("settings.watchAddHint", { name: set.name })}
                      disabled={set.addresses.length >= MAX_ADDRS}
                      onBind={(el) => {
                        watchAddRefs.current[set.id] = el;
                      }}
                      onAdd={(kind, value) => book.addWatchAddr(set.id, kind, value)}
                    />
                    {set.addresses.length ? (
                      <div className="me-list">
                        {set.addresses.map((a) => (
                          <AddrRow key={a.id} addr={a} onRemove={() => book.removeWatchAddr(set.id, a.id)} />
                        ))}
                      </div>
                    ) : (
                      <p className="me-card-empty">{t("settings.watchEmpty")}</p>
                    )}
                  </div>
                ))}
                <div className="set-chain-bar">
                  <button
                    type="button"
                    className="me-pool-btn me-pool-btn-dex"
                    disabled={book.watch.length >= MAX_WATCH}
                    onClick={() => {
                      const id = book.addWatch(t("settings.watchDefault", { n: book.watch.length + 1 }));
                      if (id) window.setTimeout(() => watchAddRefs.current[id]?.focus(), 0);
                    }}
                  >
                    {t("settings.watchAdd")}
                  </button>
                </div>
              </section>
            </>
          ) : null}

          {tab === "chains" ? <RpcSettings /> : null}

          {tab === "data" ? (
            <section className="me-card" role="tabpanel">
              <SetItem title={t("settings.outbound")} hint={t("settings.outboundHint")}>
                <OutboundFields />
              </SetItem>
              <div className="set-item">
                <div className="holding-meta">
                  <b>{t("settings.cache")}</b>
                  <span>{t("settings.cacheHint")}</span>
                </div>
                <button
                  type="button"
                  className="me-pool-btn me-pool-btn-explore"
                  disabled={wiping}
                  onClick={() => {
                    setWiping(true);
                    void cacheWipe()
                      .then(() => {
                        setWiped(true);
                        window.setTimeout(() => setWiped(false), 2000);
                      })
                      .finally(() => setWiping(false));
                  }}
                >
                  {wiped ? t("settings.cacheCleared") : wiping ? t("settings.cacheClearing") : t("settings.cacheClear")}
                </button>
              </div>
              <div className="set-item">
                <div className="holding-meta">
                  <b>{t("settings.reset")}</b>
                  <span>{t("settings.resetHint")}</span>
                </div>
                <button
                  type="button"
                  className="me-pool-btn me-pool-btn-explore"
                  onClick={() => {
                    s.reset();
                    setRestored(true);
                    window.setTimeout(() => setRestored(false), 2000);
                  }}
                >
                  {restored ? t("settings.resetDone") : t("settings.resetBtn")}
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
