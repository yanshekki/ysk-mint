import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useTranslation } from "react-i18next";
import { useAccount, useChainId, useDisconnect } from "wagmi";
import { evmEnabledChains } from "@ysk-mint/config";
import { LOCALES } from "../../lib/i18n.ts";
import {
  connectAptos,
  connectBitcoin,
  connectCardano,
  connectKeplr,
  connectNear,
  connectSolana,
  connectStarknet,
  connectStellar,
  connectSui,
  connectTon,
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
import "@near-wallet-selector/modal-ui/styles.css";
import "./nearModal.css";
import { humanDomainName, useDomainName } from "../../lib/domainNames/index.ts";
import { SolanaSelector, WalletPicker } from "./SolanaSelector.tsx";

function short(v: string, head = 6, tail = 4) {
  if (!v || v.length <= head + tail + 1) return v || "—";
  return `${v.slice(0, head)}…${v.slice(-tail)}`;
}

function chipLabel(name: string | undefined, address?: string) {
  const ens = humanDomainName(name, address);
  if (ens && ens.length <= 18) return ens;
  return address ? short(address, 4, 4) : "—";
}

export function ConnectBar() {
  const { t, i18n } = useTranslation();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const native = useNativeWallets();
  const chain = evmEnabledChains().find((c) => c.chainId === chainId);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [adaWallets, setAdaWallets] = useState<CardanoWalletInfo[]>([]);
  const [adaOpen, setAdaOpen] = useState(false);
  const [solWallets, setSolWallets] = useState<SolanaWalletInfo[]>([]);
  const [solOpen, setSolOpen] = useState(false);
  const [suiWallets, setSuiWallets] = useState<ExtraWalletInfo[]>([]);
  const [suiOpen, setSuiOpen] = useState(false);
  const [aptosWallets, setAptosWallets] = useState<ExtraWalletInfo[]>([]);
  const [aptosOpen, setAptosOpen] = useState(false);
  const [btcWallets, setBtcWallets] = useState<ExtraWalletInfo[]>([]);
  const [btcOpen, setBtcOpen] = useState(false);
  const [xrplWallets, setXrplWallets] = useState<ExtraWalletInfo[]>([]);
  const [xrplOpen, setXrplOpen] = useState(false);
  const [strkWallets, setStrkWallets] = useState<ExtraWalletInfo[]>([]);
  const [strkOpen, setStrkOpen] = useState(false);
  const [pos, setPos] = useState({ top: 72, right: 24 });
  const barRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const hasNear = Boolean(native.nearAccount);
  const hasAda = Boolean(native.cardanoAddress);
  const hasSol = Boolean(native.solanaAddress);
  const hasTron = Boolean(native.tronAddress);
  const hasSui = Boolean(native.suiAddress);
  const hasTon = Boolean(native.tonAddress);
  const hasAptos = Boolean(native.aptosAddress);
  const hasBtc = Boolean(native.bitcoinAddress);
  const hasXrpl = Boolean(native.xrplAddress);
  const hasStellar = Boolean(native.stellarAddress);
  const hasKeplr = Boolean(native.cosmosAddress || native.osmosisAddress || native.celestiaAddress);
  const hasStark = Boolean(native.starknetAddress);
  const any =
    isConnected || hasNear || hasAda || hasSol || hasTron || hasSui || hasTon || hasAptos || hasBtc || hasXrpl || hasStellar || hasKeplr || hasStark;
  const evmName = useDomainName("evm", address);
  const adaName = useDomainName("cardano", native.cardanoAddress);
  const solName = useDomainName("solana", native.solanaAddress);

  useEffect(() => {
    void restoreNearSession();
    void restoreSolanaSession();
    void restoreCardanoSession();
  }, []);

  useEffect(() => {
    if (!open) return;
    setAdaWallets(listCardanoWallets());
    void listSolanaWallets().then(setSolWallets);
    const place = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) });
    };
    place();
    const onDoc = (e: MouseEvent) => {
      const n = e.target as Node;
      if (barRef.current?.contains(n) || popRef.current?.contains(n)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const parts: string[] = [];
  if (isConnected) parts.push(chain?.short ?? "EVM");
  if (hasNear) parts.push("NEAR");
  if (hasAda) parts.push("ADA");
  if (hasSol) parts.push("SOL");
  if (hasTron) parts.push("TRX");
  if (hasSui) parts.push("SUI");
  if (hasTon) parts.push("TON");
  if (hasAptos) parts.push("APT");
  if (hasBtc) parts.push("BTC");
  if (hasXrpl) parts.push("XRP");
  if (hasStellar) parts.push("XLM");
  if (native.cosmosAddress) parts.push("ATOM");
  if (native.osmosisAddress) parts.push("OSMO");
  if (native.celestiaAddress) parts.push("TIA");
  if (hasStark) parts.push("STRK");
  const trigger =
    parts.length === 0
      ? t("wallet.connect")
      : parts.length === 1 && isConnected && address
        ? `${chain?.short ?? "EVM"} ${chipLabel(evmName, address)}`
        : parts.length === 1 && hasNear
          ? `NEAR ${chipLabel(undefined, native.nearAccount)}`
          : parts.length === 1 && hasAda
            ? `ADA ${chipLabel(adaName, native.cardanoAddress)}`
            : parts.length === 1 && hasSol
              ? `SOL ${chipLabel(solName, native.solanaAddress)}`
              : parts.join(" · ");

  return (
    <div className="session-bar" ref={barRef}>
      <label className="lang-dd-wrap">
        <span className="sr-only">{t("nav.lang")}</span>
        <select
          className="lang-dd"
          value={LOCALES.some((l) => l.id === i18n.language) ? i18n.language : "zh-HK"}
          onChange={(e) => void i18n.changeLanguage(e.target.value)}
        >
          {LOCALES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      <ConnectButton.Custom>
        {({ account, mounted, openConnectModal }) => {
          if (!mounted) {
            return (
              <button type="button" className="ghost-btn" disabled>
                {t("wallet.connect")}
              </button>
            );
          }
          const menu = (
            <div className="session-pop" ref={popRef} role="dialog" aria-label={t("wallet.session")} style={pos}>
              <p className="session-pop-title">{t("wallet.session")}</p>

              <div className="session-row">
                <div className="session-row-copy">
                  <b>EVM · {chain?.short ?? "ETH"}</b>
                  <span className="num">{account ? chipLabel(evmName, address) : t("wizard.wallet.idle")}</span>
                </div>
                {account ? (
                  <button type="button" className="ghost-btn" onClick={() => disconnect()}>
                    {t("wallet.disconnect")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wallet-cta"
                    onClick={() => {
                      setOpen(false);
                      openConnectModal();
                    }}
                  >
                    {t("wallet.connect")}
                  </button>
                )}
              </div>

              <div className="session-row">
                <div className="session-row-copy">
                  <b>NEAR</b>
                  <span className="num">{hasNear ? short(native.nearAccount, 10, 8) : t("wizard.wallet.idle")}</span>
                </div>
                {hasNear ? (
                  <button type="button" className="ghost-btn" onClick={() => void disconnectNearWallet()}>
                    {t("wallet.disconnect")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wallet-cta"
                    disabled={busy === "near"}
                    onClick={() => {
                      setBusy("near");
                      void connectNear().finally(() => setBusy(null));
                    }}
                  >
                    {t("wallet.connectNear")}
                  </button>
                )}
              </div>

              <div className="session-row">
                <div className="session-row-copy">
                  <b>Cardano</b>
                  <span className="num">{hasAda ? adaName || short(native.cardanoAddress, 10, 8) : t("wizard.wallet.idle")}</span>
                </div>
                {hasAda ? (
                  <button type="button" className="ghost-btn" onClick={() => disconnectCardanoWallet()}>
                    {t("wallet.disconnect")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wallet-cta"
                    disabled={busy === "ada"}
                    onClick={() => {
                      setOpen(false);
                      setAdaWallets(listCardanoWallets());
                      setAdaOpen(true);
                    }}
                  >
                    {t("wallet.connectCardano")}
                  </button>
                )}
              </div>

              <div className="session-row">
                <div className="session-row-copy">
                  <b>Solana</b>
                  <span className="num">{hasSol ? solName || short(native.solanaAddress, 8, 8) : t("wizard.wallet.idle")}</span>
                </div>
                {hasSol ? (
                  <button type="button" className="ghost-btn" onClick={() => void disconnectSolanaWallet()}>
                    {t("wallet.disconnect")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wallet-cta"
                    disabled={busy === "sol"}
                    onClick={() => {
                      setOpen(false);
                      void listSolanaWallets().then(setSolWallets);
                      setSolOpen(true);
                    }}
                  >
                    {t("wallet.connectSolana")}
                  </button>
                )}
              </div>

              <div className="session-row">
                <div className="session-row-copy">
                  <b>Tron</b>
                  <span className="num">{hasTron ? short(native.tronAddress, 8, 8) : t("wizard.wallet.idle")}</span>
                </div>
                {hasTron ? (
                  <button type="button" className="ghost-btn" onClick={() => disconnectTronWallet()}>
                    {t("wallet.disconnect")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wallet-cta"
                    disabled={busy === "tron"}
                    onClick={() => {
                      setBusy("tron");
                      void connectTron().finally(() => setBusy(null));
                    }}
                  >
                    {t("wallet.connectTron")}
                  </button>
                )}
              </div>

              <div className="session-row">
                <div className="session-row-copy">
                  <b>Sui</b>
                  <span className="num">{hasSui ? short(native.suiAddress, 8, 8) : t("wizard.wallet.idle")}</span>
                </div>
                {hasSui ? (
                  <button type="button" className="ghost-btn" onClick={() => disconnectSuiWallet()}>
                    {t("wallet.disconnect")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wallet-cta"
                    disabled={busy === "sui"}
                    onClick={() => {
                      setOpen(false);
                      void listSuiWallets().then(setSuiWallets);
                      setSuiOpen(true);
                    }}
                  >
                    {t("wallet.connectSui")}
                  </button>
                )}
              </div>

              <div className="session-row">
                <div className="session-row-copy">
                  <b>TON</b>
                  <span className="num">{hasTon ? short(native.tonAddress, 8, 8) : t("wizard.wallet.idle")}</span>
                </div>
                {hasTon ? (
                  <button type="button" className="ghost-btn" onClick={() => void disconnectTonWallet()}>
                    {t("wallet.disconnect")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wallet-cta"
                    disabled={busy === "ton"}
                    onClick={() => {
                      setBusy("ton");
                      void connectTon().finally(() => setBusy(null));
                    }}
                  >
                    {t("wallet.connectTon")}
                  </button>
                )}
              </div>

              <div className="session-row">
                <div className="session-row-copy">
                  <b>Aptos</b>
                  <span className="num">{hasAptos ? short(native.aptosAddress, 8, 8) : t("wizard.wallet.idle")}</span>
                </div>
                {hasAptos ? (
                  <button type="button" className="ghost-btn" onClick={() => disconnectAptosWallet()}>
                    {t("wallet.disconnect")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wallet-cta"
                    disabled={busy === "aptos"}
                    onClick={() => {
                      setOpen(false);
                      void listAptosWallets().then(setAptosWallets);
                      setAptosOpen(true);
                    }}
                  >
                    {t("wallet.connectAptos")}
                  </button>
                )}
              </div>

              <div className="session-row">
                <div className="session-row-copy">
                  <b>Bitcoin</b>
                  <span className="num">{hasBtc ? short(native.bitcoinAddress, 8, 8) : t("wizard.wallet.idle")}</span>
                </div>
                {hasBtc ? (
                  <button type="button" className="ghost-btn" onClick={() => disconnectBitcoinWallet()}>
                    {t("wallet.disconnect")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wallet-cta"
                    disabled={busy === "btc"}
                    onClick={() => {
                      setOpen(false);
                      setBtcWallets(listBitcoinWallets());
                      setBtcOpen(true);
                    }}
                  >
                    {t("wallet.connectBtc")}
                  </button>
                )}
              </div>
              <div className="session-row">
                <div className="session-row-copy">
                  <b>XRPL</b>
                  <span className="num">{hasXrpl ? short(native.xrplAddress, 8, 8) : t("wizard.wallet.idle")}</span>
                </div>
                {hasXrpl ? (
                  <button type="button" className="ghost-btn" onClick={() => disconnectXrplWallet()}>
                    {t("wallet.disconnect")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wallet-cta"
                    disabled={busy === "xrpl"}
                    onClick={() => {
                      setOpen(false);
                      setXrplWallets(listXrplWallets());
                      setXrplOpen(true);
                    }}
                  >
                    {t("wallet.connectXrpl")}
                  </button>
                )}
              </div>
              <div className="session-row">
                <div className="session-row-copy">
                  <b>Stellar</b>
                  <span className="num">{hasStellar ? short(native.stellarAddress, 8, 8) : t("wizard.wallet.idle")}</span>
                </div>
                {hasStellar ? (
                  <button type="button" className="ghost-btn" onClick={() => disconnectStellarWallet()}>
                    {t("wallet.disconnect")}
                  </button>
                ) : (
                  <button type="button" className="wallet-cta" disabled={busy === "xlm"} onClick={() => { setBusy("xlm"); void connectStellar().finally(() => setBusy(null)); }}>
                    {t("wallet.connectStellar")}
                  </button>
                )}
              </div>
              <div className="session-row">
                <div className="session-row-copy">
                  <b>Keplr</b>
                  <span className="num">{hasKeplr ? short(native.cosmosAddress || native.osmosisAddress, 8, 8) : t("wizard.wallet.idle")}</span>
                </div>
                {hasKeplr ? (
                  <button type="button" className="ghost-btn" onClick={() => disconnectKeplrWallet()}>
                    {t("wallet.disconnect")}
                  </button>
                ) : (
                  <button type="button" className="wallet-cta" disabled={busy === "keplr"} onClick={() => { setBusy("keplr"); void connectKeplr().finally(() => setBusy(null)); }}>
                    {t("wallet.connectKeplr")}
                  </button>
                )}
              </div>
              <div className="session-row">
                <div className="session-row-copy">
                  <b>Starknet</b>
                  <span className="num">{hasStark ? short(native.starknetAddress, 8, 8) : t("wizard.wallet.idle")}</span>
                </div>
                {hasStark ? (
                  <button type="button" className="ghost-btn" onClick={() => disconnectStarknetWallet()}>
                    {t("wallet.disconnect")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wallet-cta"
                    disabled={busy === "strk"}
                    onClick={() => {
                      setOpen(false);
                      setStrkWallets(listStarknetWallets());
                      setStrkOpen(true);
                    }}
                  >
                    {t("wallet.connectArgent")}
                  </button>
                )}
              </div>
            </div>
          );
          return (
            <div className="session-menu">
              <button
                ref={btnRef}
                type="button"
                className={`wallet-session-btn ${any ? "on" : ""}`}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                <span className={`wallet-dot ${any ? "wallet-dot-on" : ""}`} />
                <span className="wallet-session-label">{trigger}</span>
              </button>
              {open ? createPortal(menu, document.body) : null}
            </div>
          );
        }}
      </ConnectButton.Custom>
      <WalletPicker
        open={adaOpen}
        kicker="Cardano"
        title={t("wallet.connectCardano")}
        empty={t("wallet.noCip30")}
        mark="ADA"
        wallets={adaWallets}
        busy={busy === "ada"}
        onClose={() => setAdaOpen(false)}
        onPick={(w) => {
          if (!w.installed) {
            if (w.url) window.open(w.url, "_blank", "noopener,noreferrer");
            return;
          }
          setBusy("ada");
          void connectCardano(w.id)
            .then(() => setAdaOpen(false))
            .finally(() => setBusy(null));
        }}
      />
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
          void connectSolana(w.id)
            .then(() => setSolOpen(false))
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
          void connectSui(w.id)
            .then(() => setSuiOpen(false))
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
          void connectAptos(w.id)
            .then(() => setAptosOpen(false))
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
          void connectBitcoin(w.id)
            .then(() => setBtcOpen(false))
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
          void connectXrpl(w.id)
            .then(() => setXrplOpen(false))
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
          void connectStarknet(w.id)
            .then(() => setStrkOpen(false))
            .finally(() => setBusy(null));
        }}
      />
    </div>
  );
}
