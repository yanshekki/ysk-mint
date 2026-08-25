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

  if (!token || !chainId) return <p className="p-8">{t("token.missing")}</p>;
  const [name, symbol, decimals, supply, owner] = reads.data ?? [];

  return (
    <section className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-3 flex items-center gap-2">
        <Badge kind="info">OFT</Badge>
        <Badge kind="warn">{t("nav.disclaimer")}</Badge>
      </div>
      <h1 className="text-2xl font-black">
        {String(name?.result ?? "…")}{" "}
        <span className="text-text-muted">{String(symbol?.result ?? "")}</span>
      </h1>
      <p className="num mt-1 text-[12px] text-text-muted">{token}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-white p-4 ring-1 ring-border">
        <Metric k="chain" v={chainId} />
        <Metric k="dec" v={decimals?.result?.toString() ?? "…"} />
        <Metric k="supply" v={supply?.result?.toString() ?? "…"} />
      </div>
      <p className="num mt-3 truncate text-[11px] text-text-muted">owner {String(owner?.result ?? "…")}</p>
      <ShareCard name={String(name?.result ?? "")} address={token} />
    </section>
  );
}
