import { useParams } from "react-router-dom";
import { useReadContracts } from "wagmi";
import { useTranslation } from "react-i18next";
import { yskOftAbi } from "@ysk-mint/sdk";

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
    <section className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-bold">
        {String(name?.result ?? "…")} ({String(symbol?.result ?? "")})
      </h1>
      <dl className="mt-6 space-y-2 rounded-2xl border border-border bg-white p-4 text-sm">
        <div className="flex justify-between gap-4"><dt>chainId</dt><dd>{chainId}</dd></div>
        <div className="flex justify-between gap-4"><dt>address</dt><dd className="font-mono break-all">{token}</dd></div>
        <div className="flex justify-between gap-4"><dt>decimals()</dt><dd>{decimals?.result?.toString() ?? "…"}</dd></div>
        <div className="flex justify-between gap-4"><dt>totalSupply()</dt><dd>{supply?.result?.toString() ?? "…"}</dd></div>
        <div className="flex justify-between gap-4"><dt>owner()</dt><dd className="font-mono break-all">{String(owner?.result ?? "…")}</dd></div>
      </dl>
    </section>
  );
}
