import { useTranslation } from "react-i18next";
import { useAccount, usePublicClient } from "wagmi";
import { useEffect, useState } from "react";
import { parseAbiItem } from "viem";
import { ChainKey, isConfigured, launchContracts } from "@ysk-mint/sdk";
import { Link } from "react-router-dom";
import { CHAINS } from "@ysk-mint/config";
import { Badge, TokenRow } from "../../shared/ui/TokenRow.tsx";

const launchEvent = parseAbiItem(
  "event Launch(address indexed token, address indexed deployer, bytes32 indexed salt, string name, string symbol, uint8 supplyMode)",
);

export function MePage() {
  const { t } = useTranslation();
  const { address } = useAccount();
  const client = usePublicClient();
  const [rows, setRows] = useState<{ token: `0x${string}`; name: string; symbol: string }[]>([]);
  const contracts = launchContracts(ChainKey.BaseSepolia);
  const chainId = CHAINS[ChainKey.BaseSepolia].chainId;

  useEffect(() => {
    if (!client || !address || !isConfigured(contracts)) {
      setRows([]);
      return;
    }
    void client
      .getLogs({
        address: contracts.factory,
        event: launchEvent,
        args: { deployer: address },
        fromBlock: 0n,
        toBlock: "latest",
      })
      .then((logs) => {
        setRows(
          logs.map((l) => ({
            token: l.args.token as `0x${string}`,
            name: l.args.name ?? "",
            symbol: l.args.symbol ?? "",
          })),
        );
      })
      .catch(() => setRows([]));
  }, [client, address, contracts]);

  return (
    <section className="desk-page">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-text-muted">Portfolio</p>
      <h1 className="text-2xl font-black">{t("me.title")}</h1>
      <p className="mt-1 text-[13px] text-text-sub">{t("me.body")}</p>
      {!isConfigured(contracts) ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{t("me.noFactory")}</p>
      ) : null}
      <div className="mt-4 grid gap-2">
        {rows.map((r) => (
          <Link key={r.token} to={`/token/${chainId}/${r.token}`}>
            <TokenRow
              title={`${r.symbol || "TKN"} · ${r.name}`}
              subtitle={r.token}
              right={<Badge kind="info">OFT</Badge>}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
