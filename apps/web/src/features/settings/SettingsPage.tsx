import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { CHAINS as CHAIN_MAP, featuredChains, type ChainDefinition } from "@ysk-mint/config";
import { builtinRpc, parseRpc, pingRpc } from "../../lib/rpc.ts";
import { LOCALES } from "../../lib/i18n.ts";
import { cacheWipe } from "../../lib/defi/cache.ts";
import { chainIcon } from "../../lib/chainIcon.ts";
import { listConnected, MAX_ADDRS, MAX_WATCH, useAddressSets } from "../../lib/addressSets.ts";
import { useNativeWallets } from "../../lib/nativeWallets.ts";
import { BUY_GREEN, SELL_RED, useUserSettings, type QuotePriority, type QuoteSide } from "../../lib/userSettings.ts";
import { AddrAddBar, AddrRow } from "./AddrFields.tsx";

const CHAINS = featuredChains().filter((c) => !c.testnet);

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

function RpcRow({ chain }: { chain: ChainDefinition }) {
  const { t } = useTranslation();
  const saved = useUserSettings((s) => s.rpcByChain?.[String(chain.chainId)] ?? "");
  const setRpc = useUserSettings((s) => s.setRpc);
  const fallback = builtinRpc(chain.chainId) ?? chain.rpc;
  const [text, setText] = useState(saved);
  const [bad, setBad] = useState(false);
  const [ping, setPing] = useState<"" | "ok" | "bad" | "mismatch">("");
  useEffect(() => {
    setText(saved);
  }, [saved]);

  function commit(raw: string) {
    const next = raw.trim();
    if (!next) {
      setBad(false);
      setPing("");
      setRpc(chain.chainId, undefined);
      return;
    }
    const url = parseRpc(next);
    if (!url) {
      setBad(true);
      setPing("");
      return;
    }
    setBad(false);
    setRpc(chain.chainId, url);
    void pingRpc(url, chain.chainId).then(setPing);
  }

  const pingNote = ping === "ok" ? t("settings.rpcOk") : ping === "mismatch" ? t("settings.rpcMismatch") : ping === "bad" ? t("settings.rpcFail") : "";

  return (
    <div className={`set-rpc-row ${bad ? "is-bad" : ""}`}>
      <span className="holding-ico-wrap">
        <img src={chainIcon(chain)} alt="" className="holding-ico" />
      </span>
      <div className="holding-meta">
        <b>
          {chain.name}
          {saved ? <span className="me-count">{t("settings.rpcCustom")}</span> : null}
        </b>
        <span>{pingNote || `${chain.short} · ${chain.chainId}`}</span>
      </div>
      <input
        className="field-text set-rpc-input"
        value={text}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        placeholder={t("settings.rpcPlaceholder", { url: fallback })}
        aria-label={`${chain.short} RPC`}
        onChange={(e) => {
          setText(e.target.value);
          setPing("");
          if (bad) setBad(false);
        }}
        onBlur={() => commit(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {saved ? (
        <button
          type="button"
          className="me-pool-btn me-pool-btn-explore"
          onClick={() => {
            setText("");
            commit("");
          }}
        >
          {t("settings.rpcDefault")}
        </button>
      ) : (
        <span />
      )}
      {bad ? <p className="set-rpc-err">{t("settings.rpcBad")}</p> : null}
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
  const [chainQ, setChainQ] = useState("");
  const watchAddRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function setTab(next: SettingsTab) {
    const hash = next === "display" ? "" : `#${next}`;
    if (loc.hash === hash) return;
    navigate({ pathname: loc.pathname, search: loc.search, hash }, { replace: true });
  }

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

          {tab === "chains" ? (
            <>
              <section className="me-card" role="tabpanel">
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
                  <b>{t("settings.rpc")}</b>
                </div>
                <p className="set-note set-note-pad">{t("settings.rpcHint")}</p>
                {Object.values(CHAIN_MAP)
                  .filter((c) => c.evm && c.enabled && !c.testnet)
                  .map((c) => (
                    <RpcRow key={c.chainId} chain={c} />
                  ))}
                <p className="set-note set-note-pad">{t("settings.rpcTestnets")}</p>
                {Object.values(CHAIN_MAP)
                  .filter((c) => c.evm && c.enabled && c.testnet)
                  .map((c) => (
                    <RpcRow key={c.chainId} chain={c} />
                  ))}
              </section>
            </>
          ) : null}

          {tab === "data" ? (
            <section className="me-card" role="tabpanel">
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
