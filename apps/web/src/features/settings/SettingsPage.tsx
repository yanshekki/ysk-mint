import { useState } from "react";
import { useTranslation } from "react-i18next";
import { featuredChains } from "@ysk-mint/config";
import { LOCALES } from "../../lib/i18n.ts";
import { cacheWipe } from "../../lib/defi/cache.ts";
import { chainIcon } from "../../lib/chainIcon.ts";
import { BUY_GREEN, SELL_RED, useUserSettings, type QuotePriority, type QuoteSide } from "../../lib/userSettings.ts";

const CHAINS = featuredChains().filter((c) => !c.testnet);

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const s = useUserSettings();
  const [wiping, setWiping] = useState(false);
  const [wiped, setWiped] = useState(false);

  const lng = LOCALES.some((l) => l.id === i18n.language) ? i18n.language : "zh-HK";

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
        <div className="me-desk set-desk">
          <section className="me-card">
            <div className="me-card-head">
              <b>{t("settings.display")}</b>
            </div>
            <div className="set-body">
              <label className="set-row">
                <span>{t("nav.lang")}</span>
                <select className="lang-dd" value={lng} onChange={(e) => void i18n.changeLanguage(e.target.value)}>
                  {LOCALES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="set-row">
                <span>{t("settings.liveDock")}</span>
                <input type="checkbox" checked={s.liveDock} onChange={(e) => s.patch({ liveDock: e.target.checked })} />
              </label>
              <label className="set-row">
                <span>{t("settings.hideZero")}</span>
                <input type="checkbox" checked={s.hideZero} onChange={(e) => s.patch({ hideZero: e.target.checked })} />
              </label>
            </div>
          </section>

          <section className="me-card">
            <div className="me-card-head">
              <b>{t("settings.markets")}</b>
            </div>
            <div className="set-body">
              <label className="set-row">
                <span>{t("settings.autoOrient")}</span>
                <input type="checkbox" checked={s.autoOrient} onChange={(e) => s.patch({ autoOrient: e.target.checked })} />
              </label>
              <div className={`set-row ${s.autoOrient ? "" : "set-row-off"}`}>
                <span>{t("settings.quoteSide")}</span>
                <span className="set-pills">
                  {(["right", "left"] as QuoteSide[]).map((side) => (
                    <button
                      key={side}
                      type="button"
                      className={`set-pill ${s.quoteSide === side ? "on" : ""}`}
                      disabled={!s.autoOrient}
                      onClick={() => s.patch({ quoteSide: side })}
                    >
                      {t(side === "right" ? "settings.quoteRight" : "settings.quoteLeft")}
                    </button>
                  ))}
                </span>
              </div>
              <div className={`set-row ${s.autoOrient ? "" : "set-row-off"}`}>
                <span>{t("settings.quotePriority")}</span>
                <span className="set-pills">
                  {(["stable-gas", "gas-stable"] as QuotePriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`set-pill ${s.quotePriority === p ? "on" : ""}`}
                      disabled={!s.autoOrient}
                      onClick={() => s.patch({ quotePriority: p })}
                    >
                      {t(p === "stable-gas" ? "settings.priStable" : "settings.priGas")}
                    </button>
                  ))}
                </span>
              </div>
            </div>
          </section>

          <section className="me-card">
            <div className="me-card-head">
              <b>{t("settings.trades")}</b>
            </div>
            <div className="set-body">
              <div className="set-row">
                <span>{t("settings.tradePreview")}</span>
                <span className="set-preview">
                  <i className="holding-ico me-oft-mark me-trade-buy">{t("lp.tradeBuyMark")}</i>
                  <i className="holding-ico me-oft-mark me-trade-sell">{t("lp.tradeSellMark")}</i>
                </span>
              </div>
              <div className="set-row">
                <span>{t("settings.presets")}</span>
                <span className="set-pills">
                  <button
                    type="button"
                    className="set-pill"
                    onClick={() => s.patch({ buyColor: BUY_GREEN, sellColor: SELL_RED })}
                  >
                    {t("settings.presetGreenRed")}
                  </button>
                  <button
                    type="button"
                    className="set-pill"
                    onClick={() => s.patch({ buyColor: SELL_RED, sellColor: BUY_GREEN })}
                  >
                    {t("settings.presetRedGreen")}
                  </button>
                </span>
              </div>
              <label className="set-row">
                <span>{t("lp.tradeBuy")}</span>
                <input type="color" value={s.buyColor} onChange={(e) => s.patch({ buyColor: e.target.value })} />
              </label>
              <label className="set-row">
                <span>{t("lp.tradeSell")}</span>
                <input type="color" value={s.sellColor} onChange={(e) => s.patch({ sellColor: e.target.value })} />
              </label>
            </div>
          </section>

          <section className="me-card">
            <div className="me-card-head">
              <b>{t("settings.chains")}</b>
            </div>
            <div className="set-body">
              <p className="set-note">{t("settings.chainsHint")}</p>
              <div className="me-chips set-chains">
                {CHAINS.map((c) => {
                  const on = !s.disabledChains.includes(c.chainId);
                  return (
                    <button
                      key={c.chainId}
                      type="button"
                      className={`me-chip ${on ? "me-chip-on" : ""}`}
                      onClick={() => s.setChainEnabled(c.chainId, !on)}
                    >
                      <img src={chainIcon(c)} alt="" width={20} height={20} />
                      {c.short}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="me-card">
            <div className="me-card-head">
              <b>{t("settings.data")}</b>
            </div>
            <div className="set-body">
              <div className="set-row">
                <span>{t("settings.cache")}</span>
                <button
                  type="button"
                  className="ghost-btn set-action"
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
              <div className="set-row">
                <span>{t("settings.reset")}</span>
                <button type="button" className="ghost-btn set-action" onClick={() => s.reset()}>
                  {t("settings.resetBtn")}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
