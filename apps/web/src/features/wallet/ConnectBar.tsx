import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useTranslation } from "react-i18next";

export function ConnectBar() {
  const { t } = useTranslation();
  return (
    <div className="scale-[0.92] origin-right">
      <ConnectButton label={t("wallet.connect")} showBalance={false} chainStatus="none" accountStatus="address" />
    </div>
  );
}
