import { useParams } from "react-router-dom";
import { useReadContract } from "wagmi";
import { useTranslation } from "react-i18next";
import { launchContracts, liquidityLockerAbi } from "@ysk-mint/sdk";
import { Badge, Metric } from "../../shared/ui/TokenRow.tsx";
import { chainByEvmId } from "../../lib/launchTargets.ts";

export function LockPage() {
  const { t } = useTranslation();
  const { chainId, lockId } = useParams();
  const cid = Number(chainId);
  const def = Number.isFinite(cid) ? chainByEvmId(cid) : undefined;
  const contracts = def ? launchContracts(def.key) : undefined;
  const id = lockId ? BigInt(lockId) : undefined;
  const lock = useReadContract({
    address: contracts?.locker,
    abi: liquidityLockerAbi,
    functionName: "getLock",
    args: id !== undefined ? [id] : undefined,
    chainId: Number.isFinite(cid) ? cid : undefined,
    query: {
      enabled:
        Boolean(contracts?.locker && contracts.locker !== "0x0000000000000000000000000000000000000000") &&
        id !== undefined &&
        Number.isFinite(cid),
    },
  });

  if (!lockId) return <p className="workspace-scroll">{t("lock.missing")}</p>;

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <div className="mb-1 flex gap-2">
            <Badge kind="ok">LOCK</Badge>
            {lock.data?.withdrawn ? <Badge kind="warn">OUT</Badge> : <Badge kind="info">HELD</Badge>}
          </div>
          <h1>#{lockId}</h1>
        </div>
      </div>
      <div className="workspace-scroll">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="rounded-xl bg-bg-subtle p-4">
            <Metric k="amount" v={lock.data?.amount.toString() ?? "…"} />
          </div>
          <div className="rounded-xl bg-bg-subtle p-4">
            <Metric k="unlock" v={lock.data?.unlockAt.toString() ?? "…"} />
          </div>
          <div className="rounded-xl bg-bg-subtle p-4">
            <Metric k="token" v={lock.data?.token ?? "…"} />
          </div>
        </div>
      </div>
    </section>
  );
}
