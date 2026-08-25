import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useTranslation } from "react-i18next";
import { useAccount, useChainId, useDisconnect } from "wagmi";
import { evmEnabledChains } from "@ysk-mint/config";
import { LOCALES } from "../../lib/i18n.ts";
import {
  connectCardano,
  connectNear,
  disconnectNearWallet,
  listCardanoWallets,
  restoreNearSession,
  useNativeWallets,
  type CardanoWalletInfo,
} from "../../lib/nativeWallets.ts";
import "@near-wallet-selector/modal-ui/styles.css";
import "./nearModal.css";

function short(v: string, head = 6, tail = 4) {
  if (!v || v.length <= head + tail + 1) return v || "—";
  return `${v.slice(0, head)}…${v.slice(-tail)}`;
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
  const root = useRef<HTMLDivElement>(null);

  const hasNear = Boolean(native.nearAccount);
  const hasAda = Boolean(native.cardanoAddress);
  const any = isConnected || hasNear || hasAda;

  useEffect(() => {
    void restoreNearSession();
  }, []);

  useEffect(() => {
    if (!open) return;
    setAdaWallets(listCardanoWallets());
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const parts: string[] = [];
  if (isConnected) parts.push(chain?.short ?? "EVM");
  if (hasNear) parts.push("NEAR");
  if (hasAda) parts.push("ADA");
  const trigger =
    parts.length === 0
      ? t("wallet.connect")
      : parts.length === 1 && isConnected && address
        ? `${chain?.short ?? "EVM"} ${short(address, 4, 4)}`
        : parts.length === 1 && hasNear
          ? `NEAR ${short(native.nearAccount, 6, 4)}`
          : parts.length === 1 && hasAda
            ? `ADA ${short(native.cardanoAddress, 6, 4)}`
            : parts.join(" · ");

  return (
    <div className="session-bar" ref={root}>
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
          return (
            <>
              <button
                type="button"
                className={`wallet-session-btn ${any ? "on" : ""}`}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                <span className={`wallet-dot ${any ? "wallet-dot-on" : ""}`} />
                {trigger}
              </button>
              {open ? (
                <div className="session-pop" role="dialog" aria-label={t("wallet.session")}>
                  <p className="session-pop-title">{t("wallet.session")}</p>

                  <div className="session-row">
                    <div>
                      <b>EVM · {chain?.short ?? "ETH"}</b>
                      <span className="num">{account ? account.displayName : t("wizard.wallet.idle")}</span>
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
                    <div>
                      <b>NEAR</b>
                      <span className="num">
                        {hasNear ? short(native.nearAccount, 10, 8) : t("wizard.wallet.idle")}
                      </span>
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
                    <div>
                      <b>Cardano</b>
                      <span className="num">
                        {hasAda ? short(native.cardanoAddress, 10, 8) : t("wizard.wallet.idle")}
                      </span>
                      {!hasAda && adaWallets.length ? (
                        <div className="session-ada-wallets">
                          {adaWallets.map((w) => (
                            <button
                              key={w.id}
                              type="button"
                              className="wallet-chip"
                              disabled={busy === "ada"}
                              onClick={() => {
                                setBusy("ada");
                                void connectCardano(w.id).finally(() => setBusy(null));
                              }}
                            >
                              {w.name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {!hasAda && !adaWallets.length ? <span>{t("wallet.noCip30")}</span> : null}
                    </div>
                    {hasAda ? (
                      <button type="button" className="ghost-btn" onClick={() => native.disconnectCardano()}>
                        {t("wallet.disconnect")}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
}
