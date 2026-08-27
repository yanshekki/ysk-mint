import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { featuredChains } from "@ysk-mint/config";
import { LOCALES } from "../../lib/i18n.ts";
import { cacheWipe } from "../../lib/defi/cache.ts";
import { chainIcon } from "../../lib/chainIcon.ts";
import { BUY_GREEN, SELL_RED, useUserSettings, type QuotePriority, type QuoteSide } from "../../lib/userSettings.ts";

const CHAINS = featuredChains().filter((c) => !c.testnet);

const DEMO_ICO: Record<string, string> = {
  WAVAX: "/tokens/avax.png",
  USDC: "/tokens/usdc.png",
};

function SetSwitch({ on }: { on: boolean }) {
  return (
    <span className={`set-switch ${on ? "on" : ""}`} aria-hidden="true">
      <i />
    </span>
  );
}

function SetItem({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="set-item">
      <div className="holding-meta">
        <b>{title}</b>
        <span>{hint}</span>
      </div>
      <div className="set-ctrl">{children}</div>
    </div>
  );
}

function SetToggle({ title, hint, on, onChange }: { title: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className="set-item set-item-btn" aria-pressed={on} onClick={() => onChange(!on)}>
      <div className="holding-meta">
        <b>{title}</b>
        <span>{hint}</span>
      </div>
      <SetSwitch on={on} />
    </button>
  );
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const s = useUserSettings();
  const [wiping, setWiping] = useState(false);
  const [wiped, setWiped] = useState(false);
  const [restored, setRestored] = useState(false);
  const [chainQ, setChainQ] = useState("");

  const lng = LOCALES.some((l) => l.id === i18n.language) ? i18n.language : "zh-HK";
  const onCount = CHAINS.length - s.disabledChains.filter((id) => CHAINS.some((c) => c.chainId === id)).length;

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

  const q = chainQ.trim().toLowerCase();
  const visibleChains = useMemo(() => {
    if (!q) return CHAINS;
    return CHAINS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.short.toLowerCase().includes(q) ||
        c.nativeSymbol.toLowerCase().includes(q) ||
        String(c.chainId) === q,
    );
  }, [q]);

  const greenRed = s.buyColor === BUY_GREEN && s.sellColor === SELL_RED;
  const redGreen = s.buyColor === SELL_RED && s.sellColor === BUY_GREEN;

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">{t("settings.kicker")}</p>
          <h1>{t("nav.settings")}</h1>
          <p className="mt-1 text-[15px] text-text-sub">{t("settings.hint")}</p>
        </div>
      </div>
      <div className="workspace-scroll">
        <div className="me-desk">
          <section className="me-card">
            <div className="me-card-head">
              <b>{t("settings.display")}</b>
            </div>
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
          </section>

          <section className="me-card">
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
          </section>

          <section className="me-card">
            <div className="me-card-head">
              <b>{t("settings.trades")}</b>
            </div>
            <div className="me-token set-live">
              <span className="holding-ico-wrap">
                <span className="holding-ico me-oft-mark me-trade-buy">{t("lp.tradeBuyMark")}</span>
              </span>
              <div className="holding-meta">
                <b>{t("lp.tradeBuy")}</b>
                <span>{t("settings.tradeBuyHint")}</span>
              </div>
              <span className="num holding-amt set-amt-buy">18.40 USDC</span>
            </div>
            <div className="me-token set-live">
              <span className="holding-ico-wrap">
                <span className="holding-ico me-oft-mark me-trade-sell">{t("lp.tradeSellMark")}</span>
              </span>
              <div className="holding-meta">
                <b>{t("lp.tradeSell")}</b>
                <span>{t("settings.tradeSellHint")}</span>
              </div>
              <span className="num holding-amt set-amt-sell">18.32 USDC</span>
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
                  <input
                    type="color"
                    value={s.buyColor}
                    aria-label={t("lp.tradeBuy")}
                    onChange={(e) => s.patch({ buyColor: e.target.value })}
                  />
                </label>
                <label className="set-swatch">
                  <span>{t("lp.tradeSell")}</span>
                  <i style={{ background: s.sellColor }} />
                  <input
                    type="color"
                    value={s.sellColor}
                    aria-label={t("lp.tradeSell")}
                    onChange={(e) => s.patch({ sellColor: e.target.value })}
                  />
                </label>
              </div>
            </SetItem>
          </section>

          <section className="me-card">
            <div className="me-card-head">
              <b>{t("settings.chains")}</b>
              <input
                className="me-filter"
                type="text"
                value={chainQ}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => setChainQ(e.target.value)}
                placeholder={t("settings.chainSearch")}
                aria-label={t("settings.chainSearch")}
              />
              <span className="me-count">{t("settings.chainsOn", { on: onCount, total: CHAINS.length })}</span>
            </div>
            <div className="set-chain-bar">
              <p className="set-note">{t("settings.chainsHint")}</p>
              <button type="button" className="me-pool-btn me-pool-btn-explore" onClick={() => s.patch({ disabledChains: [] })}>
                {t("settings.allOn")}
              </button>
              <button
                type="button"
                className="me-pool-btn me-pool-btn-explore"
                onClick={() => s.patch({ disabledChains: CHAINS.map((c) => c.chainId) })}
              >
                {t("settings.allOff")}
              </button>
            </div>
            {onCount === 0 ? <p className="me-card-empty">{t("settings.chainsNone")}</p> : null}
            {visibleChains.length === 0 ? (
              <p className="me-card-empty">{t("settings.chainEmpty")}</p>
            ) : (
              <div className="me-list set-chain-list">
                {visibleChains.map((c) => {
                  const on = !s.disabledChains.includes(c.chainId);
                  return (
                    <button
                      key={c.chainId}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      className={`me-token ${on ? "" : "me-token-zero"}`}
                      onClick={() => s.setChainEnabled(c.chainId, !on)}
                    >
                      <span className="holding-ico-wrap">
                        <img src={chainIcon(c)} alt="" className="holding-ico" />
                      </span>
                      <div className="holding-meta">
                        <b>{c.name}</b>
                        <span>
                          {c.short} · {on ? t("settings.chainOn") : t("settings.chainOff")}
                        </span>
                      </div>
                      <SetSwitch on={on} />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="me-card">
            <div className="me-card-head">
              <b>{t("settings.data")}</b>
            </div>
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
        </div>
      </div>
    </section>
  );
}
