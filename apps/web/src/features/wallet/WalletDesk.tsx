import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import "@near-wallet-selector/modal-ui/styles.css";
import "./nearModal.css";
import {
  connectCardano,
  connectNear,
  connectSolana,
  disconnectCardanoWallet,
  disconnectNearWallet,
  disconnectSolanaWallet,
  listCardanoWallets,
  listSolanaWallets,
  restoreCardanoSession,
  restoreNearSession,
  restoreSolanaSession,
  useNativeWallets,
  type CardanoWalletInfo,
  type SolanaWalletInfo,
} from "../../lib/nativeWallets.ts";
import { useAdaHandle, useEvmName, useSolName } from "../../lib/chainNames.ts";
import { useCardanoHoldings, useEvmHoldings, useNearHoldings, useSolanaHoldings } from "../../lib/useHoldings.ts";
import { HoldingsList } from "./HoldingsList.tsx";
import { SolanaSelector } from "./SolanaSelector.tsx";

function short(v: string, head = 8, tail = 6) {
  if (!v || v.length <= head + tail + 1) return v || "—";
  return `${v.slice(0, head)}…${v.slice(-tail)}`;
}

function StatusDot({ on }: { on: boolean }) {
  return <span className={`wallet-dot ${on ? "wallet-dot-on" : ""}`} />;
}

function BrandMark({ src, className }: { src: string; className: string }) {
  return (
    <div className={`wallet-mark ${className}`}>
      <img src={src} alt="" />
    </div>
  );
}

function AddrFace({
  connected,
  name,
  address,
  idle,
  head = 10,
  tail = 8,
}: {
  connected: boolean;
  name?: string;
  address?: string;
  idle: string;
  head?: number;
  tail?: number;
}) {
  if (!connected || !address) {
    return <p className="wallet-addr num wallet-addr-idle">{idle}</p>;
  }
  return (
    <p className={`wallet-addr ${name ? "wallet-addr-named" : ""}`}>
      {name ? <span className="wallet-addr-name">{name}</span> : null}
      <span className="num">{short(address, head, tail)}</span>
    </p>
  );
}

export function WalletDesk() {
  const { t } = useTranslation();
  const { address, isConnected } = useAccount();
  const native = useNativeWallets();
  const [adaWallets, setAdaWallets] = useState<CardanoWalletInfo[]>([]);
  const [solWallets, setSolWallets] = useState<SolanaWalletInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [nearErr, setNearErr] = useState<string | null>(null);
  const [adaErr, setAdaErr] = useState<string | null>(null);
  const [solErr, setSolErr] = useState<string | null>(null);
  const [solOpen, setSolOpen] = useState(false);

  const onCount =
    Number(isConnected) + Number(!!native.nearAccount) + Number(!!native.cardanoAddress) + Number(!!native.solanaAddress);
  const evmHold = useEvmHoldings(address);
  const nearHold = useNearHoldings(native.nearAccount);
  const adaHold = useCardanoHoldings(native.cardanoAddress, {
    addresses: native.cardanoAddresses,
    stake: native.cardanoStake,
    sync: native.cardanoSync,
  });
  const solHold = useSolanaHoldings(native.solanaAddress);
  const evmName = useEvmName(address);
  const adaName = useAdaHandle(native.cardanoAddress, native.cardanoStake);
  const solName = useSolName(native.solanaAddress);

  useEffect(() => {
    void restoreNearSession();
    void restoreSolanaSession();
    const scan = () => {
      setAdaWallets(listCardanoWallets());
      void restoreCardanoSession();
    };
    scan();
    const timers = [400, 1200, 3000].map((ms) => window.setTimeout(scan, ms));
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
            <BrandMark src="/tokens/eth.png" className="wallet-mark-evm" />
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
          <div className="wallet-pane-main">
            <AddrFace
              connected={isConnected}
              name={evmName}
              address={address}
              idle={t("wizard.wallet.idle")}
              head={10}
              tail={8}
            />
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
                    {t("wallet.disconnect")}
                  </button>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </article>

        <article className={`wallet-pane ${native.nearAccount ? "wallet-pane-on" : ""}`}>
          <div className="wallet-pane-top">
            <BrandMark src="/tokens/near.png" className="wallet-mark-near" />
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
          <div className="wallet-pane-main">
            <AddrFace
              connected={Boolean(native.nearAccount)}
              address={native.nearAccount}
              idle={t("wizard.wallet.idle")}
              head={14}
              tail={8}
            />
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
            <BrandMark src="/tokens/ada.png" className="wallet-mark-ada" />
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
          <div className="wallet-pane-main">
            <AddrFace
              connected={Boolean(native.cardanoAddress)}
              name={adaName}
              address={native.cardanoAddress}
              idle={t("wizard.wallet.idle")}
              head={12}
              tail={8}
            />
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
              <button type="button" className="ghost-btn wallet-cta-block" onClick={() => disconnectCardanoWallet()}>
                {t("wallet.disconnect")}
              </button>
            ) : adaWallets.length ? (
              <div className="wallet-chips">
                {adaWallets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
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
                ))}
              </div>
            ) : (
              <button type="button" className="ghost-btn wallet-cta-block" disabled>
                {t("wallet.noCip30")}
              </button>
            )}
          </div>
        </article>

        <article className={`wallet-pane ${native.solanaAddress ? "wallet-pane-on" : ""}`}>
          <div className="wallet-pane-top">
            <BrandMark src="/tokens/sol.png" className="wallet-mark-sol" />
            <div className="wallet-pane-copy">
              <div className="wallet-pane-title">
                <h3>{t("wallet.solana")}</h3>
                <span className={`wallet-state ${native.solanaAddress ? "on" : ""}`}>
                  <StatusDot on={!!native.solanaAddress} />
                  {native.solanaAddress ? t("wizard.wallet.ready") : t("wizard.wallet.idle")}
                </span>
              </div>
              <p>{t("wallet.solHint")}</p>
            </div>
          </div>
          <div className="wallet-pane-main">
            <AddrFace
              connected={Boolean(native.solanaAddress)}
              name={solName}
              address={native.solanaAddress}
              idle={t("wizard.wallet.idle")}
              head={8}
              tail={8}
            />
            {solErr ? <p className="wallet-err">{solErr}</p> : null}
            <HoldingsList
              rows={solHold.rows}
              funded={solHold.funded}
              connected={Boolean(native.solanaAddress)}
              loading={solHold.loading}
            />
          </div>
          <div className="wallet-pane-foot">
            {native.solanaAddress ? (
              <button type="button" className="ghost-btn wallet-cta-block" onClick={() => void disconnectSolanaWallet()}>
                {t("wallet.disconnect")}
              </button>
            ) : (
              <button
                type="button"
                className="wallet-cta wallet-cta-block"
                disabled={busy === "sol"}
                onClick={() => {
                  setSolErr(null);
                  void listSolanaWallets().then(setSolWallets);
                  setSolOpen(true);
                }}
              >
                {t("wallet.connectSolana")}
              </button>
            )}
          </div>
        </article>
      </div>
      <SolanaSelector
        open={solOpen}
        wallets={solWallets}
        busy={busy === "sol"}
        onClose={() => setSolOpen(false)}
        onPick={(w) => {
          if (!w.installed) {
            if (w.url) window.open(w.url, "_blank", "noopener,noreferrer");
            return;
          }
          setBusy("sol");
          setSolErr(null);
          void connectSolana(w.id)
            .then(() => setSolOpen(false))
            .catch((err: unknown) => setSolErr(err instanceof Error ? err.message : String(err)))
            .finally(() => setBusy(null));
        }}
      />
    </div>
  );
}
