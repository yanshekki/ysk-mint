import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import "@near-wallet-selector/modal-ui/styles.css";
import "./nearModal.css";
import {
  connectAptos,
  connectBitcoin,
  connectCardano,
  connectKeplr,
  connectNear,
  connectSolana,
  connectSui,
  connectTon,
  connectStarknet,
  connectStellar,
  connectTron,
  connectXrpl,
  disconnectAptosWallet,
  disconnectBitcoinWallet,
  disconnectCardanoWallet,
  disconnectNearWallet,
  disconnectSolanaWallet,
  disconnectSuiWallet,
  disconnectTonWallet,
  disconnectKeplrWallet,
  disconnectStarknetWallet,
  disconnectStellarWallet,
  disconnectTronWallet,
  disconnectXrplWallet,
  listAptosWallets,
  listBitcoinWallets,
  listCardanoWallets,
  listSolanaWallets,
  listStarknetWallets,
  listSuiWallets,
  listXrplWallets,
  restoreCardanoSession,
  restoreNearSession,
  restoreSolanaSession,
  useNativeWallets,
  type CardanoWalletInfo,
  type ExtraWalletInfo,
  type SolanaWalletInfo,
} from "../../lib/nativeWallets.ts";
import { useAdaHandle, useEvmName, useSolName } from "../../lib/chainNames.ts";
import {
  useAptosHoldings,
  useBitcoinHoldings,
  useCardanoHoldings,
  useCelestiaHoldings,
  useCosmosHoldings,
  useEvmHoldings,
  useNearHoldings,
  useOsmosisHoldings,
  useSolanaHoldings,
  useStarknetHoldings,
  useStellarHoldings,
  useSuiHoldings,
  useTonHoldings,
  useTronHoldings,
  useXrplHoldings,
} from "../../lib/useHoldings.ts";
import { HoldingsList } from "./HoldingsList.tsx";
import { SolanaSelector, WalletPicker } from "./SolanaSelector.tsx";

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
    return <div className="wallet-addr wallet-addr-idle">{idle}</div>;
  }
  return (
    <div className={`wallet-addr ${name ? "wallet-addr-named" : ""}`}>
      {name ? <div className="wallet-addr-name">{name}</div> : null}
      <div className="wallet-addr-hex num">{short(address, head, tail)}</div>
    </div>
  );
}

export function WalletDesk() {
  const { t } = useTranslation();
  const { address, isConnected } = useAccount();
  const native = useNativeWallets();
  const [adaWallets, setAdaWallets] = useState<CardanoWalletInfo[]>([]);
  const [solWallets, setSolWallets] = useState<SolanaWalletInfo[]>([]);
  const [suiWallets, setSuiWallets] = useState<ExtraWalletInfo[]>([]);
  const [aptosWallets, setAptosWallets] = useState<ExtraWalletInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [nearErr, setNearErr] = useState<string | null>(null);
  const [adaErr, setAdaErr] = useState<string | null>(null);
  const [solErr, setSolErr] = useState<string | null>(null);
  const [tronErr, setTronErr] = useState<string | null>(null);
  const [suiErr, setSuiErr] = useState<string | null>(null);
  const [tonErr, setTonErr] = useState<string | null>(null);
  const [aptosErr, setAptosErr] = useState<string | null>(null);
  const [btcErr, setBtcErr] = useState<string | null>(null);
  const [xrplErr, setXrplErr] = useState<string | null>(null);
  const [xlmErr, setXlmErr] = useState<string | null>(null);
  const [keplrErr, setKeplrErr] = useState<string | null>(null);
  const [strkErr, setStrkErr] = useState<string | null>(null);
  const [solOpen, setSolOpen] = useState(false);
  const [suiOpen, setSuiOpen] = useState(false);
  const [aptosOpen, setAptosOpen] = useState(false);
  const [btcOpen, setBtcOpen] = useState(false);
  const [xrplOpen, setXrplOpen] = useState(false);
  const [strkOpen, setStrkOpen] = useState(false);
  const [btcWallets, setBtcWallets] = useState<ExtraWalletInfo[]>([]);
  const [xrplWallets, setXrplWallets] = useState<ExtraWalletInfo[]>([]);
  const [strkWallets, setStrkWallets] = useState<ExtraWalletInfo[]>([]);

  const onCount =
    Number(isConnected) +
    Number(!!native.nearAccount) +
    Number(!!native.cardanoAddress) +
    Number(!!native.solanaAddress) +
    Number(!!native.tronAddress) +
    Number(!!native.suiAddress) +
    Number(!!native.tonAddress) +
    Number(!!native.aptosAddress) +
    Number(!!native.bitcoinAddress) +
    Number(!!native.xrplAddress) +
    Number(!!native.stellarAddress) +
    Number(!!(native.cosmosAddress || native.osmosisAddress || native.celestiaAddress)) +
    Number(!!native.starknetAddress);
  const evmHold = useEvmHoldings(address);
  const nearHold = useNearHoldings(native.nearAccount);
  const adaHold = useCardanoHoldings(native.cardanoAddress, {
    addresses: native.cardanoAddresses,
    stake: native.cardanoStake,
    sync: native.cardanoSync,
  });
  const solHold = useSolanaHoldings(native.solanaAddress);
  const tronHold = useTronHoldings(native.tronAddress);
  const suiHold = useSuiHoldings(native.suiAddress);
  const tonHold = useTonHoldings(native.tonAddress);
  const aptosHold = useAptosHoldings(native.aptosAddress);
  const btcHold = useBitcoinHoldings(native.bitcoinAddress);
  const xrplHold = useXrplHoldings(native.xrplAddress);
  const xlmHold = useStellarHoldings(native.stellarAddress);
  const atomHold = useCosmosHoldings(native.cosmosAddress);
  const osmoHold = useOsmosisHoldings(native.osmosisAddress);
  const tiaHold = useCelestiaHoldings(native.celestiaAddress);
  const strkHold = useStarknetHoldings(native.starknetAddress);
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

        <article className={`wallet-pane ${native.tronAddress ? "wallet-pane-on" : ""}`}>
          <div className="wallet-pane-top">
            <BrandMark src="/tokens/trx.png" className="wallet-mark-evm" />
            <div className="wallet-pane-copy">
              <div className="wallet-pane-title">
                <h3>{t("wallet.tron")}</h3>
                <span className={`wallet-state ${native.tronAddress ? "on" : ""}`}>
                  <StatusDot on={!!native.tronAddress} />
                  {native.tronAddress ? t("wizard.wallet.ready") : t("wizard.wallet.idle")}
                </span>
              </div>
              <p>{t("wallet.tronHint")}</p>
            </div>
          </div>
          <div className="wallet-pane-main">
            <AddrFace connected={Boolean(native.tronAddress)} address={native.tronAddress} idle={t("wizard.wallet.idle")} />
            {tronErr ? <p className="wallet-err">{tronErr}</p> : null}
            <HoldingsList rows={tronHold.rows} funded={tronHold.funded} connected={Boolean(native.tronAddress)} loading={tronHold.loading} />
          </div>
          <div className="wallet-pane-foot">
            {native.tronAddress ? (
              <button type="button" className="ghost-btn wallet-cta-block" onClick={() => disconnectTronWallet()}>
                {t("wallet.disconnect")}
              </button>
            ) : (
              <button
                type="button"
                className="wallet-cta wallet-cta-block"
                disabled={busy === "tron"}
                onClick={() => {
                  setBusy("tron");
                  setTronErr(null);
                  void connectTron()
                    .catch((err: unknown) => setTronErr(err instanceof Error ? err.message : String(err)))
                    .finally(() => setBusy(null));
                }}
              >
                {t("wallet.connectTron")}
              </button>
            )}
          </div>
        </article>

        <article className={`wallet-pane ${native.suiAddress ? "wallet-pane-on" : ""}`}>
          <div className="wallet-pane-top">
            <BrandMark src="/tokens/sui.png" className="wallet-mark-evm" />
            <div className="wallet-pane-copy">
              <div className="wallet-pane-title">
                <h3>{t("wallet.sui")}</h3>
                <span className={`wallet-state ${native.suiAddress ? "on" : ""}`}>
                  <StatusDot on={!!native.suiAddress} />
                  {native.suiAddress ? t("wizard.wallet.ready") : t("wizard.wallet.idle")}
                </span>
              </div>
              <p>{t("wallet.suiHint")}</p>
            </div>
          </div>
          <div className="wallet-pane-main">
            <AddrFace connected={Boolean(native.suiAddress)} address={native.suiAddress} idle={t("wizard.wallet.idle")} />
            {suiErr ? <p className="wallet-err">{suiErr}</p> : null}
            <HoldingsList rows={suiHold.rows} funded={suiHold.funded} connected={Boolean(native.suiAddress)} loading={suiHold.loading} />
          </div>
          <div className="wallet-pane-foot">
            {native.suiAddress ? (
              <button type="button" className="ghost-btn wallet-cta-block" onClick={() => disconnectSuiWallet()}>
                {t("wallet.disconnect")}
              </button>
            ) : (
              <button
                type="button"
                className="wallet-cta wallet-cta-block"
                disabled={busy === "sui"}
                onClick={() => {
                  setSuiErr(null);
                  void listSuiWallets().then(setSuiWallets);
                  setSuiOpen(true);
                }}
              >
                {t("wallet.connectSui")}
              </button>
            )}
          </div>
        </article>

        <article className={`wallet-pane ${native.tonAddress ? "wallet-pane-on" : ""}`}>
          <div className="wallet-pane-top">
            <BrandMark src="/tokens/ton.png" className="wallet-mark-evm" />
            <div className="wallet-pane-copy">
              <div className="wallet-pane-title">
                <h3>{t("wallet.ton")}</h3>
                <span className={`wallet-state ${native.tonAddress ? "on" : ""}`}>
                  <StatusDot on={!!native.tonAddress} />
                  {native.tonAddress ? t("wizard.wallet.ready") : t("wizard.wallet.idle")}
                </span>
              </div>
              <p>{t("wallet.tonHint")}</p>
            </div>
          </div>
          <div className="wallet-pane-main">
            <AddrFace connected={Boolean(native.tonAddress)} address={native.tonAddress} idle={t("wizard.wallet.idle")} />
            {tonErr ? <p className="wallet-err">{tonErr}</p> : null}
            <HoldingsList rows={tonHold.rows} funded={tonHold.funded} connected={Boolean(native.tonAddress)} loading={tonHold.loading} />
          </div>
          <div className="wallet-pane-foot">
            {native.tonAddress ? (
              <button type="button" className="ghost-btn wallet-cta-block" onClick={() => void disconnectTonWallet()}>
                {t("wallet.disconnect")}
              </button>
            ) : (
              <button
                type="button"
                className="wallet-cta wallet-cta-block"
                disabled={busy === "ton"}
                onClick={() => {
                  setBusy("ton");
                  setTonErr(null);
                  void connectTon()
                    .catch((err: unknown) => setTonErr(err instanceof Error ? err.message : String(err)))
                    .finally(() => setBusy(null));
                }}
              >
                {t("wallet.connectTon")}
              </button>
            )}
          </div>
        </article>

        <article className={`wallet-pane ${native.aptosAddress ? "wallet-pane-on" : ""}`}>
          <div className="wallet-pane-top">
            <BrandMark src="/tokens/apt.png" className="wallet-mark-evm" />
            <div className="wallet-pane-copy">
              <div className="wallet-pane-title">
                <h3>{t("wallet.aptos")}</h3>
                <span className={`wallet-state ${native.aptosAddress ? "on" : ""}`}>
                  <StatusDot on={!!native.aptosAddress} />
                  {native.aptosAddress ? t("wizard.wallet.ready") : t("wizard.wallet.idle")}
                </span>
              </div>
              <p>{t("wallet.aptosHint")}</p>
            </div>
          </div>
          <div className="wallet-pane-main">
            <AddrFace connected={Boolean(native.aptosAddress)} address={native.aptosAddress} idle={t("wizard.wallet.idle")} />
            {aptosErr ? <p className="wallet-err">{aptosErr}</p> : null}
            <HoldingsList rows={aptosHold.rows} funded={aptosHold.funded} connected={Boolean(native.aptosAddress)} loading={aptosHold.loading} />
          </div>
          <div className="wallet-pane-foot">
            {native.aptosAddress ? (
              <button type="button" className="ghost-btn wallet-cta-block" onClick={() => disconnectAptosWallet()}>
                {t("wallet.disconnect")}
              </button>
            ) : (
              <button
                type="button"
                className="wallet-cta wallet-cta-block"
                disabled={busy === "aptos"}
                onClick={() => {
                  setAptosErr(null);
                  void listAptosWallets().then(setAptosWallets);
                  setAptosOpen(true);
                }}
              >
                {t("wallet.connectAptos")}
              </button>
            )}
          </div>
        </article>

        <article className={`wallet-pane ${native.bitcoinAddress ? "wallet-pane-on" : ""}`}>
          <div className="wallet-pane-top">
            <BrandMark src="/tokens/btc.png" className="wallet-mark-evm" />
            <div className="wallet-pane-copy">
              <div className="wallet-pane-title">
                <h3>{t("wallet.bitcoin")}</h3>
                <span className={`wallet-state ${native.bitcoinAddress ? "on" : ""}`}>
                  <StatusDot on={!!native.bitcoinAddress} />
                  {native.bitcoinAddress ? t("wizard.wallet.ready") : t("wizard.wallet.idle")}
                </span>
              </div>
              <p>{t("wallet.btcHint")}</p>
            </div>
          </div>
          <div className="wallet-pane-main">
            <AddrFace connected={Boolean(native.bitcoinAddress)} address={native.bitcoinAddress} idle={t("wizard.wallet.idle")} />
            {btcErr ? <p className="wallet-err">{btcErr}</p> : null}
            <HoldingsList rows={btcHold.rows} funded={btcHold.funded} connected={Boolean(native.bitcoinAddress)} loading={btcHold.loading} />
          </div>
          <div className="wallet-pane-foot">
            {native.bitcoinAddress ? (
              <button type="button" className="ghost-btn wallet-cta-block" onClick={() => disconnectBitcoinWallet()}>
                {t("wallet.disconnect")}
              </button>
            ) : (
              <button
                type="button"
                className="wallet-cta wallet-cta-block"
                disabled={busy === "btc"}
                onClick={() => {
                  setBtcErr(null);
                  setBtcWallets(listBitcoinWallets());
                  setBtcOpen(true);
                }}
              >
                {t("wallet.connectBtc")}
              </button>
            )}
          </div>
        </article>

        <article className={`wallet-pane ${native.xrplAddress ? "wallet-pane-on" : ""}`}>
          <div className="wallet-pane-top">
            <BrandMark src="/tokens/xrp.png" className="wallet-mark-evm" />
            <div className="wallet-pane-copy">
              <div className="wallet-pane-title">
                <h3>{t("wallet.xrpl")}</h3>
                <span className={`wallet-state ${native.xrplAddress ? "on" : ""}`}>
                  <StatusDot on={!!native.xrplAddress} />
                  {native.xrplAddress ? t("wizard.wallet.ready") : t("wizard.wallet.idle")}
                </span>
              </div>
              <p>{t("wallet.xrplHint")}</p>
            </div>
          </div>
          <div className="wallet-pane-main">
            <AddrFace connected={Boolean(native.xrplAddress)} address={native.xrplAddress} idle={t("wizard.wallet.idle")} />
            {xrplErr ? <p className="wallet-err">{xrplErr}</p> : null}
            <HoldingsList rows={xrplHold.rows} funded={xrplHold.funded} connected={Boolean(native.xrplAddress)} loading={xrplHold.loading} />
          </div>
          <div className="wallet-pane-foot">
            {native.xrplAddress ? (
              <button type="button" className="ghost-btn wallet-cta-block" onClick={() => disconnectXrplWallet()}>
                {t("wallet.disconnect")}
              </button>
            ) : (
              <button
                type="button"
                className="wallet-cta wallet-cta-block"
                disabled={busy === "xrpl"}
                onClick={() => {
                  setXrplErr(null);
                  setXrplWallets(listXrplWallets());
                  setXrplOpen(true);
                }}
              >
                {t("wallet.connectXrpl")}
              </button>
            )}
          </div>
        </article>

        <article className={`wallet-pane ${native.stellarAddress ? "wallet-pane-on" : ""}`}>
          <div className="wallet-pane-top">
            <BrandMark src="/tokens/xlm.png" className="wallet-mark-evm" />
            <div className="wallet-pane-copy">
              <div className="wallet-pane-title">
                <h3>{t("wallet.stellar")}</h3>
                <span className={`wallet-state ${native.stellarAddress ? "on" : ""}`}>
                  <StatusDot on={!!native.stellarAddress} />
                  {native.stellarAddress ? t("wizard.wallet.ready") : t("wizard.wallet.idle")}
                </span>
              </div>
              <p>{t("wallet.stellarHint")}</p>
            </div>
          </div>
          <div className="wallet-pane-main">
            <AddrFace connected={Boolean(native.stellarAddress)} address={native.stellarAddress} idle={t("wizard.wallet.idle")} />
            {xlmErr ? <p className="wallet-err">{xlmErr}</p> : null}
            <HoldingsList rows={xlmHold.rows} funded={xlmHold.funded} connected={Boolean(native.stellarAddress)} loading={xlmHold.loading} />
          </div>
          <div className="wallet-pane-foot">
            {native.stellarAddress ? (
              <button type="button" className="ghost-btn wallet-cta-block" onClick={() => disconnectStellarWallet()}>
                {t("wallet.disconnect")}
              </button>
            ) : (
              <button
                type="button"
                className="wallet-cta wallet-cta-block"
                disabled={busy === "xlm"}
                onClick={() => {
                  setBusy("xlm");
                  setXlmErr(null);
                  void connectStellar()
                    .catch((err: unknown) => setXlmErr(err instanceof Error ? err.message : String(err)))
                    .finally(() => setBusy(null));
                }}
              >
                {t("wallet.connectStellar")}
              </button>
            )}
          </div>
        </article>

        <article className={`wallet-pane ${native.cosmosAddress || native.osmosisAddress || native.celestiaAddress ? "wallet-pane-on" : ""}`}>
          <div className="wallet-pane-top">
            <BrandMark src="/tokens/atom.png" className="wallet-mark-evm" />
            <div className="wallet-pane-copy">
              <div className="wallet-pane-title">
                <h3>{t("wallet.keplr")}</h3>
                <span className={`wallet-state ${native.cosmosAddress || native.osmosisAddress || native.celestiaAddress ? "on" : ""}`}>
                  <StatusDot on={!!(native.cosmosAddress || native.osmosisAddress || native.celestiaAddress)} />
                  {native.cosmosAddress || native.osmosisAddress || native.celestiaAddress ? t("wizard.wallet.ready") : t("wizard.wallet.idle")}
                </span>
              </div>
              <p>{t("wallet.keplrHint")}</p>
            </div>
          </div>
          <div className="wallet-pane-main">
            <AddrFace
              connected={Boolean(native.cosmosAddress || native.osmosisAddress || native.celestiaAddress)}
              address={native.cosmosAddress || native.osmosisAddress || native.celestiaAddress}
              idle={t("wizard.wallet.idle")}
            />
            {keplrErr ? <p className="wallet-err">{keplrErr}</p> : null}
            <HoldingsList
              rows={[...atomHold.rows, ...osmoHold.rows, ...tiaHold.rows]}
              funded={atomHold.funded + osmoHold.funded + tiaHold.funded}
              connected={Boolean(native.cosmosAddress || native.osmosisAddress || native.celestiaAddress)}
              loading={atomHold.loading || osmoHold.loading || tiaHold.loading}
            />
          </div>
          <div className="wallet-pane-foot">
            {native.cosmosAddress || native.osmosisAddress || native.celestiaAddress ? (
              <button type="button" className="ghost-btn wallet-cta-block" onClick={() => disconnectKeplrWallet()}>
                {t("wallet.disconnect")}
              </button>
            ) : (
              <button
                type="button"
                className="wallet-cta wallet-cta-block"
                disabled={busy === "keplr"}
                onClick={() => {
                  setBusy("keplr");
                  setKeplrErr(null);
                  void connectKeplr()
                    .catch((err: unknown) => setKeplrErr(err instanceof Error ? err.message : String(err)))
                    .finally(() => setBusy(null));
                }}
              >
                {t("wallet.connectKeplr")}
              </button>
            )}
          </div>
        </article>

        <article className={`wallet-pane ${native.starknetAddress ? "wallet-pane-on" : ""}`}>
          <div className="wallet-pane-top">
            <BrandMark src="/tokens/strk.png" className="wallet-mark-evm" />
            <div className="wallet-pane-copy">
              <div className="wallet-pane-title">
                <h3>{t("wallet.starknet")}</h3>
                <span className={`wallet-state ${native.starknetAddress ? "on" : ""}`}>
                  <StatusDot on={!!native.starknetAddress} />
                  {native.starknetAddress ? t("wizard.wallet.ready") : t("wizard.wallet.idle")}
                </span>
              </div>
              <p>{t("wallet.starkHint")}</p>
            </div>
          </div>
          <div className="wallet-pane-main">
            <AddrFace connected={Boolean(native.starknetAddress)} address={native.starknetAddress} idle={t("wizard.wallet.idle")} />
            {strkErr ? <p className="wallet-err">{strkErr}</p> : null}
            <HoldingsList rows={strkHold.rows} funded={strkHold.funded} connected={Boolean(native.starknetAddress)} loading={strkHold.loading} />
          </div>
          <div className="wallet-pane-foot">
            {native.starknetAddress ? (
              <button type="button" className="ghost-btn wallet-cta-block" onClick={() => disconnectStarknetWallet()}>
                {t("wallet.disconnect")}
              </button>
            ) : (
              <button
                type="button"
                className="wallet-cta wallet-cta-block"
                disabled={busy === "strk"}
                onClick={() => {
                  setStrkErr(null);
                  setStrkWallets(listStarknetWallets());
                  setStrkOpen(true);
                }}
              >
                {t("wallet.connectArgent")}
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
      <WalletPicker
        open={suiOpen}
        kicker="Sui"
        title={t("wallet.connectSui")}
        empty={t("wallet.noSui")}
        mark="SUI"
        wallets={suiWallets}
        busy={busy === "sui"}
        onClose={() => setSuiOpen(false)}
        onPick={(w) => {
          if (!w.installed) {
            if (w.url) window.open(w.url, "_blank", "noopener,noreferrer");
            return;
          }
          setBusy("sui");
          setSuiErr(null);
          void connectSui(w.id)
            .then(() => setSuiOpen(false))
            .catch((err: unknown) => setSuiErr(err instanceof Error ? err.message : String(err)))
            .finally(() => setBusy(null));
        }}
      />
      <WalletPicker
        open={aptosOpen}
        kicker="Aptos"
        title={t("wallet.connectAptos")}
        empty={t("wallet.noAptos")}
        mark="APT"
        wallets={aptosWallets}
        busy={busy === "aptos"}
        onClose={() => setAptosOpen(false)}
        onPick={(w) => {
          if (!w.installed) {
            if (w.url) window.open(w.url, "_blank", "noopener,noreferrer");
            return;
          }
          setBusy("aptos");
          setAptosErr(null);
          void connectAptos(w.id)
            .then(() => setAptosOpen(false))
            .catch((err: unknown) => setAptosErr(err instanceof Error ? err.message : String(err)))
            .finally(() => setBusy(null));
        }}
      />
      <WalletPicker
        open={btcOpen}
        kicker="Bitcoin"
        title={t("wallet.connectBtc")}
        empty={t("wallet.noBtc")}
        mark="BTC"
        wallets={btcWallets}
        busy={busy === "btc"}
        onClose={() => setBtcOpen(false)}
        onPick={(w) => {
          if (!w.installed) {
            if (w.url) window.open(w.url, "_blank", "noopener,noreferrer");
            return;
          }
          setBusy("btc");
          setBtcErr(null);
          void connectBitcoin(w.id)
            .then(() => setBtcOpen(false))
            .catch((err: unknown) => setBtcErr(err instanceof Error ? err.message : String(err)))
            .finally(() => setBusy(null));
        }}
      />
      <WalletPicker
        open={xrplOpen}
        kicker="XRPL"
        title={t("wallet.connectXrpl")}
        empty={t("wallet.noXrpl")}
        mark="XRP"
        wallets={xrplWallets}
        busy={busy === "xrpl"}
        onClose={() => setXrplOpen(false)}
        onPick={(w) => {
          if (!w.installed) {
            if (w.url) window.open(w.url, "_blank", "noopener,noreferrer");
            return;
          }
          setBusy("xrpl");
          setXrplErr(null);
          void connectXrpl(w.id)
            .then(() => setXrplOpen(false))
            .catch((err: unknown) => setXrplErr(err instanceof Error ? err.message : String(err)))
            .finally(() => setBusy(null));
        }}
      />
      <WalletPicker
        open={strkOpen}
        kicker="Starknet"
        title={t("wallet.connectArgent")}
        empty={t("wallet.noArgent")}
        mark="STRK"
        wallets={strkWallets}
        busy={busy === "strk"}
        onClose={() => setStrkOpen(false)}
        onPick={(w) => {
          if (!w.installed) {
            if (w.url) window.open(w.url, "_blank", "noopener,noreferrer");
            return;
          }
          setBusy("strk");
          setStrkErr(null);
          void connectStarknet(w.id)
            .then(() => setStrkOpen(false))
            .catch((err: unknown) => setStrkErr(err instanceof Error ? err.message : String(err)))
            .finally(() => setBusy(null));
        }}
      />
    </div>
  );
}
