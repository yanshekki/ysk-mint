import { useParams } from "react-router-dom";
import { useReadContract } from "wagmi";
import { useTranslation } from "react-i18next";
import { ChainKey, launchContracts, liquidityLockerAbi } from "@ysk-mint/sdk";

export function LockPage() {
  const { t } = useTranslation();
  const { lockId } = useParams();
  const contracts = launchContracts(ChainKey.BaseSepolia);
  const id = lockId ? BigInt(lockId) : undefined;
  const lock = useReadContract({
    address: contracts?.locker,
    abi: liquidityLockerAbi,
    functionName: "getLock",
    args: id !== undefined ? [id] : undefined,
    query: { enabled: Boolean(contracts?.locker && contracts.locker !== "0x0000000000000000000000000000000000000000") && id !== undefined },
  });

  if (!lockId) return <p className="p-8">{t("lock.missing")}</p>;

  return (
    <section className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-bold">Lock #{lockId}</h1>
      <dl className="mt-6 space-y-2 rounded-2xl border border-border bg-white p-4 text-sm">
        <div className="flex justify-between gap-4"><dt>token</dt><dd className="font-mono break-all">{lock.data?.token ?? "…"}</dd></div>
        <div className="flex justify-between gap-4"><dt>owner</dt><dd className="font-mono break-all">{lock.data?.owner ?? "…"}</dd></div>
        <div className="flex justify-between gap-4"><dt>amount</dt><dd>{lock.data?.amount.toString() ?? "…"}</dd></div>
        <div className="flex justify-between gap-4"><dt>unlockAt</dt><dd>{lock.data?.unlockAt.toString() ?? "…"}</dd></div>
        <div className="flex justify-between gap-4"><dt>withdrawn</dt><dd>{lock.data ? String(lock.data.withdrawn) : "…"}</dd></div>
      </dl>
    </section>
  );
}
