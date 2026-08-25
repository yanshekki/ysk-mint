import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAccount, useChainId } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { featuredChains } from "@ysk-mint/config";
import "@near-wallet-selector/modal-ui/styles.css";
import "./nearModal.css";
import {
  connectCardano,
  connectNear,
  disconnectNearWallet,
  listCardanoWallets,
  pingCardanoTip,
  restoreNearSession,
  useNativeWallets,
  type CardanoWalletInfo,
} from "../../lib/nativeWallets.ts";
import { useCardanoHoldings, useEvmHoldings, useNearHoldings } from "../../lib/useHoldings.ts";
import { HoldingsList } from "./HoldingsList.tsx";

function short(v: string, head = 8, tail = 6) {
  if (!v || v.length <= head + tail + 1) return v || "—";
  return `${v.slice(0, head)}…${v.slice(-tail)}`;
}

function StatusDot({ on }: { on: boolean }) {
  return <span className={`wallet-dot ${on ? "wallet-dot-on" : ""}`} />;
}

export function WalletDesk() {
  const { t } = useTranslation();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const native = useNativeWallets();
  const [adaWallets, setAdaWallets] = useState<CardanoWalletInfo[]>([]);
  const [adaHeight, setAdaHeight] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [nearErr, setNearErr] = useState<string | null>(null);
  const [adaErr, setAdaErr] = useState<string | null>(null);

  const evmChains = featuredChains().filter((c) => c.evm && !c.testnet);
  const onCount = Number(isConnected) + Number(!!native.nearAccount) + Number(!!native.cardanoAddress);
  const evmHold = useEvmHoldings(address, chainId);
  const nearHold = useNearHoldings(native.nearAccount);
  const adaHold = useCardanoHoldings(native.cardanoAddress);

  useEffect(() => {
    void restoreNearSession();
    const scan = () => setAdaWallets(listCardanoWallets());
    scan();
    const timers = [400, 1200, 3000].map((ms) => window.setTimeout(scan, ms));
    void pingCardanoTip().then(setAdaHeight);
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  return (
    <div className="wallet-desk">
      <header className="wallet-desk-head">
        <div>
          <p className="wallet-kicker">{t("wallet.session")}</p>
          <h2 className="wallet-desk-title">{t("wizard.wallet.need")}</h2>
        </div>
        <p className="wallet-count">
          {t("wallet.count", { n: onCount })}
        </p>
      </header>

      <div className="wallet-panes">
        <article className={`wallet-pane ${isConnected ? "wallet-pane-on" : ""}`}>
          <div className="wallet-pane-top">
            <div className="wallet-mark wallet-mark-evm">EVM</div>
            <div className="wallet-pane-copy">
              <div className="wallet-pane-title">
                <h3>{t("wallet.evm")}</h3>
                <span className={`wallet-state ${isConnected ? "on" : ""}`}>
                  <StatusDot on={isConnected} />
                  {isConnected ? t("wizard.wallet.ready") : t("wizard.wallet.idle")}
                </span>
              </div>
              <p>{t("wallet.evmHint")}</p>
            </div>
          </div>
          <div className="wallet-chips" aria-label={t("wallet.evm")}>
            {evmChains.map((c) => (
              <span
                key={c.key}
                className={`wallet-chip ${isConnected && chainId === c.chainId ? "wallet-chip-on" : "wallet-chip-static"}`}
              >
                {c.short}
              </span>
            ))}
          </div>
          <div className="wallet-pane-main">
            <p className={`wallet-addr num ${isConnected ? "" : "wallet-addr-idle"}`}>
              {isConnected && address ? short(address, 10, 8) : t("wizard.wallet.idle")}
            </p>
            <HoldingsList
              rows={evmHold.rows}
              funded={evmHold.funded}
              connected={isConnected}
              loading={evmHold.loading}
            />
          </div>
          <div className="wallet-pane-foot">
            <ConnectButton.Custom>
              {({ mounted, openConnectModal, openAccountModal, account }) => {
                if (!mounted) {
                  return (
                    <button type="button" className="wallet-cta wallet-cta-block" disabled>
                      {t("wallet.connect")}
                    </button>
                  );
                }
                if (!account) {
                  return (
                    <button type="button" className="wallet-cta wallet-cta-block" onClick={openConnectModal}>
                      {t("wallet.connectEvm")}
                    </button>
                  );
                }
                return (
                  <button type="button" className="ghost-btn wallet-cta-block" onClick={openAccountModal}>
                    {t("wallet.disconnect")} · {account.displayName}
                  </button>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </article>

        <article className={`wallet-pane ${native.nearAccount ? "wallet-pane-on" : ""}`}>
          <div className="wallet-pane-top">
            <div className="wallet-mark wallet-mark-near">NEAR</div>
            <div className="wallet-pane-copy">
              <div className="wallet-pane-title">
                <h3>{t("wallet.near")}</h3>
                <span className={`wallet-state ${native.nearAccount ? "on" : ""}`}>
                  <StatusDot on={!!native.nearAccount} />
                  {native.nearAccount ? t("wizard.wallet.ready") : t("wizard.wallet.idle")}
                </span>
              </div>
              <p>{t("wallet.nearHint")}</p>
            </div>
          </div>
          <div className="wallet-chips" aria-hidden="true" />
          <div className="wallet-pane-main">
            <p className={`wallet-addr num ${native.nearAccount ? "" : "wallet-addr-idle"}`}>
              {native.nearAccount ? short(native.nearAccount, 10, 8) : t("wizard.wallet.idle")}
            </p>
            {nearErr ? <p className="wallet-err">{nearErr}</p> : null}
            <HoldingsList
              rows={nearHold.rows}
              funded={nearHold.funded}
              connected={Boolean(native.nearAccount)}
              loading={nearHold.loading}
            />
          </div>
          <div className="wallet-pane-foot">
            {native.nearAccount ? (
              <button type="button" className="ghost-btn wallet-cta-block" onClick={() => void disconnectNearWallet()}>
                {t("wallet.disconnect")}
              </button>
            ) : (
              <button
                id="ysk-near-connect"
                type="button"
                className="wallet-cta wallet-cta-block"
                disabled={busy === "near"}
                onClick={() => {
                  setBusy("near");
                  setNearErr(null);
                  void connectNear()
                    .catch((err: unknown) => setNearErr(err instanceof Error ? err.message : String(err)))
                    .finally(() => setBusy(null));
                }}
              >
                {t("wallet.connectNear")}
              </button>
            )}
          </div>
        </article>

        <article className={`wallet-pane ${native.cardanoAddress ? "wallet-pane-on" : ""}`}>
          <div className="wallet-pane-top">
            <div className="wallet-mark wallet-mark-ada">ADA</div>
            <div className="wallet-pane-copy">
              <div className="wallet-pane-title">
                <h3>{t("wallet.cardano")}</h3>
                <span className={`wallet-state ${native.cardanoAddress ? "on" : ""}`}>
                  <StatusDot on={!!native.cardanoAddress} />
                  {native.cardanoAddress ? t("wizard.wallet.ready") : t("wizard.wallet.idle")}
                </span>
              </div>
              <p>{t("wallet.adaHint")}</p>
            </div>
          </div>
          <div className="wallet-chips" role="radiogroup" aria-label={t("wallet.cardano")}>
            {adaWallets.length ? (
              adaWallets.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  role="radio"
                  aria-checked={native.cardanoWallet === w.id}
                  className={`wallet-chip ${native.cardanoWallet === w.id ? "wallet-chip-on" : ""}`}
                  disabled={busy === "ada"}
                  onClick={() => {
                    setBusy("ada");
                    setAdaErr(null);
                    void connectCardano(w.id)
                      .catch((err: unknown) => setAdaErr(err instanceof Error ? err.message : String(err)))
                      .finally(() => setBusy(null));
                  }}
                >
                  {w.icon ? <img src={w.icon} alt="" className="wallet-ico" /> : null}
                  {w.name}
                </button>
              ))
            ) : (
              <span className="wallet-chip wallet-chip-static">{t("wallet.noCip30")}</span>
            )}
            {adaHeight ? <span className="wallet-chip wallet-chip-static num">#{adaHeight}</span> : null}
          </div>
          <div className="wallet-pane-main">
            <p className={`wallet-addr num ${native.cardanoAddress ? "" : "wallet-addr-idle"}`}>
              {native.cardanoAddress ? short(native.cardanoAddress, 12, 8) : t("wizard.wallet.idle")}
            </p>
            {adaErr ? <p className="wallet-err">{adaErr}</p> : null}
            <HoldingsList
              rows={adaHold.rows}
              funded={adaHold.funded}
              connected={Boolean(native.cardanoAddress)}
              loading={adaHold.loading}
            />
          </div>
          <div className="wallet-pane-foot">
            {native.cardanoAddress ? (
              <button type="button" className="ghost-btn wallet-cta-block" onClick={() => native.disconnectCardano()}>
                {t("wallet.disconnect")}
              </button>
            ) : adaWallets.length ? (
              <p className="wallet-foot-hint">{t("wallet.pickCip30")}</p>
            ) : (
              <button type="button" className="ghost-btn wallet-cta-block" disabled>
                {t("wallet.noCip30")}
              </button>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
