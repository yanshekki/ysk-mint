import { useParams } from "react-router-dom";
import { useReadContract } from "wagmi";
import { useTranslation } from "react-i18next";
import { ChainKey, launchContracts, liquidityLockerAbi } from "@ysk-mint/sdk";
import { Badge, Metric } from "../../shared/ui/TokenRow.tsx";

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
    query: {
      enabled:
        Boolean(contracts?.locker && contracts.locker !== "0x0000000000000000000000000000000000000000") &&
        id !== undefined,
    },
  });

  if (!lockId) return <p className="p-8">{t("lock.missing")}</p>;

  return (
    <section className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-3 flex gap-2">
        <Badge kind="ok">LOCK</Badge>
        {lock.data?.withdrawn ? <Badge kind="warn">OUT</Badge> : <Badge kind="info">HELD</Badge>}
      </div>
      <h1 className="text-2xl font-black">#{lockId}</h1>
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-white p-4 ring-1 ring-border">
        <Metric k="amount" v={lock.data?.amount.toString() ?? "…"} />
        <Metric k="unlock" v={lock.data?.unlockAt.toString() ?? "…"} />
      </div>
      <p className="num mt-3 truncate text-[11px] text-text-muted">{lock.data?.token ?? "…"}</p>
    </section>
  );
}
