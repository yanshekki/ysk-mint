import { useTranslation } from "react-i18next";
import { useReadContract } from "wagmi";
import { ChainKey, liquidityLockerAbi, yskOftAbi, launchContracts } from "@ysk-mint/sdk";
import { Link } from "react-router-dom";
import { useWizard } from "./store.ts";
import { CHAINS } from "@ysk-mint/config";

export function StepSuccess() {
  const { t } = useTranslation();
  const w = useWizard();
  const contracts = launchContracts(ChainKey.BaseSepolia);
  const chainId = CHAINS[ChainKey.BaseSepolia].chainId;
  const token = w.tokenAddress;
  const lockId = w.lockId ? BigInt(w.lockId) : undefined;

  const name = useReadContract({
    address: token,
    abi: yskOftAbi,
    functionName: "name",
    query: { enabled: Boolean(token) },
  });
  const supply = useReadContract({
    address: token,
    abi: yskOftAbi,
    functionName: "totalSupply",
    query: { enabled: Boolean(token) },
  });
  const lock = useReadContract({
    address: contracts?.locker,
    abi: liquidityLockerAbi,
    functionName: "getLock",
    args: lockId !== undefined ? [lockId] : undefined,
    query: { enabled: Boolean(contracts?.locker) && lockId !== undefined },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t("wizard.success.title")}</h2>
      <p className="text-sm text-text-sub">{t("wizard.success.reread")}</p>
      <dl className="space-y-2 rounded-2xl border border-border bg-white p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt>{t("wizard.success.token")}</dt>
          <dd className="font-mono break-all">{token ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>name()</dt>
          <dd>{name.data ?? "…"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>totalSupply()</dt>
          <dd>{supply.data?.toString() ?? "…"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>{t("wizard.success.lock")}</dt>
          <dd>{lock.data ? `${lock.data.amount.toString()} @ ${lock.data.unlockAt}` : "…"}</dd>
        </div>
      </dl>
      {token ? (
        <Link className="text-sm font-medium text-brand-blue" to={`/token/${chainId}/${token}`}>
          /token/{chainId}/{token}
        </Link>
      ) : null}
      {w.lockId ? (
        <div>
          <Link className="text-sm font-medium text-brand-blue" to={`/locks/${chainId}/${w.lockId}`}>
            /locks/{chainId}/{w.lockId}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
