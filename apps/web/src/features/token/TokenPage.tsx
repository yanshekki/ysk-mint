import { useParams } from "react-router-dom";
import { useReadContracts } from "wagmi";
import { useTranslation } from "react-i18next";
import { yskOftAbi } from "@ysk-mint/sdk";
import { ShareCard } from "./ShareCard.tsx";
import { Badge, Metric } from "../../shared/ui/TokenRow.tsx";

export function TokenPage() {
  const { t } = useTranslation();
  const { chainId, address } = useParams();
  const token = address as `0x${string}` | undefined;
  const reads = useReadContracts({
    contracts: token
      ? [
          { address: token, abi: yskOftAbi, functionName: "name" },
          { address: token, abi: yskOftAbi, functionName: "symbol" },
          { address: token, abi: yskOftAbi, functionName: "decimals" },
          { address: token, abi: yskOftAbi, functionName: "totalSupply" },
          { address: token, abi: yskOftAbi, functionName: "owner" },
        ]
      : [],
    query: { enabled: Boolean(token) },
  });

  if (!token || !chainId) return <p className="workspace-scroll">{t("token.missing")}</p>;
  const [name, symbol, decimals, supply, owner] = reads.data ?? [];

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge kind="info">OFT</Badge>
            <Badge kind="warn">{t("nav.disclaimer")}</Badge>
          </div>
          <h1>
            {String(name?.result ?? "…")}{" "}
            <span className="text-text-muted">{String(symbol?.result ?? "")}</span>
          </h1>
          <p className="num mt-1 text-[12px] text-text-muted">{token}</p>
        </div>
      </div>
      <div className="workspace-scroll">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl bg-bg-subtle p-4">
            <Metric k="chain" v={chainId} />
          </div>
          <div className="rounded-xl bg-bg-subtle p-4">
            <Metric k="dec" v={decimals?.result?.toString() ?? "…"} />
          </div>
          <div className="rounded-xl bg-bg-subtle p-4">
            <Metric k="supply" v={supply?.result?.toString() ?? "…"} />
          </div>
          <div className="rounded-xl bg-bg-subtle p-4">
            <Metric k="owner" v={String(owner?.result ?? "…")} />
          </div>
        </div>
        <div className="mt-6">
          <ShareCard name={String(name?.result ?? "")} address={token} />
        </div>
      </div>
    </section>
  );
}
