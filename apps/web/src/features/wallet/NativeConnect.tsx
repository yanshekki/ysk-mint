import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../shared/ui/TokenRow.tsx";
import {
  captureNearRedirect,
  connectCardano,
  connectNearInjected,
  listCardanoWallets,
  openMyNearWallet,
  pingCardanoTip,
  pingNearRpc,
  useNativeWallets,
} from "../../lib/nativeWallets.ts";

function short(v: string) {
  if (v.length < 16) return v;
  return `${v.slice(0, 8)}…${v.slice(-6)}`;
}

export function NativeConnect() {
  const { t } = useTranslation();
  const native = useNativeWallets();
  const [adaWallets, setAdaWallets] = useState<{ key: string; name: string }[]>([]);
  const [nearHeight, setNearHeight] = useState<string | null>(null);
  const [adaHeight, setAdaHeight] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    captureNearRedirect();
    setAdaWallets(listCardanoWallets());
    void pingNearRpc().then(setNearHeight);
    void pingCardanoTip().then(setAdaHeight);
  }, []);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="token-row">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-bg-subtle text-[10px] font-black">NEAR</div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold">{t("wallet.near")}</p>
          <p className="num truncate text-[11px] text-text-muted">
            {native.nearAccount || t("wizard.wallet.idle")}
            {nearHeight ? ` · #${nearHeight}` : ""}
          </p>
        </div>
        {native.nearAccount ? (
          <button type="button" className="ghost-btn" onClick={() => native.disconnectNear()}>
            {t("wallet.disconnect")}
          </button>
        ) : (
          <button
            type="button"
            className="wallet-cta"
            disabled={busy === "near"}
            onClick={() => {
              setBusy("near");
              void connectNearInjected()
                .then((id) => {
                  if (!id) openMyNearWallet();
                })
                .finally(() => setBusy(null));
            }}
          >
            {t("wallet.connectNear")}
          </button>
        )}
      </div>
      <div className="token-row">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-bg-subtle text-[10px] font-black">ADA</div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold">{t("wallet.cardano")}</p>
          <p className="num truncate text-[11px] text-text-muted">
            {native.cardanoAddress ? short(native.cardanoAddress) : t("wizard.wallet.idle")}
            {adaHeight ? ` · #${adaHeight}` : ""}
          </p>
        </div>
        {native.cardanoAddress ? (
          <button type="button" className="ghost-btn" onClick={() => native.disconnectCardano()}>
            {t("wallet.disconnect")}
          </button>
        ) : adaWallets.length ? (
          <select
            className="chain-dd"
            defaultValue=""
            onChange={(e) => {
              const key = e.target.value;
              if (!key) return;
              setBusy("ada");
              void connectCardano(key).finally(() => setBusy(null));
            }}
          >
            <option value="">{t("wallet.connectCardano")}</option>
            {adaWallets.map((w) => (
              <option key={w.key} value={w.key}>
                {w.name}
              </option>
            ))}
          </select>
        ) : (
          <Badge kind="warn">{t("wallet.noCip30")}</Badge>
        )}
      </div>
    </div>
  );
}
