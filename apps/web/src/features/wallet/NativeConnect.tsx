import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "@near-wallet-selector/modal-ui/styles.css";
import { Badge } from "../../shared/ui/TokenRow.tsx";
import {
  connectCardano,
  connectNear,
  disconnectNearWallet,
  listCardanoWallets,
  pingCardanoTip,
  pingNearRpc,
  restoreNearSession,
  useNativeWallets,
  type CardanoWalletInfo,
} from "../../lib/nativeWallets.ts";

function short(v: string) {
  if (v.length < 16) return v;
  return `${v.slice(0, 8)}…${v.slice(-6)}`;
}

export function NativeConnect() {
  const { t } = useTranslation();
  const native = useNativeWallets();
  const [adaWallets, setAdaWallets] = useState<CardanoWalletInfo[]>([]);
  const [nearHeight, setNearHeight] = useState<string | null>(null);
  const [adaHeight, setAdaHeight] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void restoreNearSession();
    const scan = () => setAdaWallets(listCardanoWallets());
    scan();
    const timers = [400, 1200, 3000].map((ms) => window.setTimeout(scan, ms));
    void pingNearRpc().then(setNearHeight);
    void pingCardanoTip().then(setAdaHeight);
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="token-row">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-bg-subtle text-[12px] font-black">NEAR</div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold">{t("wallet.near")}</p>
          <p className="num truncate text-[13px] text-text-muted">
            {native.nearAccount || t("wizard.wallet.idle")}
            {nearHeight ? ` · #${nearHeight}` : ""}
          </p>
        </div>
        {native.nearAccount ? (
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
      <div className="token-row">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-bg-subtle text-[12px] font-black">ADA</div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold">{t("wallet.cardano")}</p>
          <p className="num truncate text-[13px] text-text-muted">
            {native.cardanoAddress ? short(native.cardanoAddress) : t("wizard.wallet.idle")}
            {adaHeight ? ` · #${adaHeight}` : ""}
          </p>
        </div>
        {native.cardanoAddress ? (
          <button type="button" className="ghost-btn" onClick={() => native.disconnectCardano()}>
            {t("wallet.disconnect")}
          </button>
        ) : adaWallets.length ? (
          <div className="flex flex-wrap gap-2">
            {adaWallets.map((w) => (
              <button
                key={w.id}
                type="button"
                className="ghost-btn"
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
        ) : (
          <Badge kind="warn">{t("wallet.noCip30")}</Badge>
        )}
      </div>
    </div>
  );
}
