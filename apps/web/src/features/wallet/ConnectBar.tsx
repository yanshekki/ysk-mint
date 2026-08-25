import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useTranslation } from "react-i18next";
import { useAccount, useChainId } from "wagmi";
import { baseSepolia, arbitrumSepolia } from "wagmi/chains";

const allowed: ReadonlySet<number> = new Set([baseSepolia.id, arbitrumSepolia.id]);

export function ConnectBar() {
  const { t } = useTranslation();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const wrong = isConnected && !allowed.has(chainId);

  return (
    <div className="flex flex-col items-end gap-2">
      <ConnectButton label={t("wallet.connect")} showBalance chainStatus="icon" />
      {wrong ? <p className="text-xs text-red-600">{t("wallet.wrongNetwork")}</p> : null}
    </div>
  );
}
