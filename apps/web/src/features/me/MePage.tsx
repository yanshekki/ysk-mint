import { useTranslation } from "react-i18next";
import { useAccount, usePublicClient } from "wagmi";
import { useEffect, useState } from "react";
import { parseAbiItem } from "viem";
import { ChainKey, isConfigured, launchContracts } from "@ysk-mint/sdk";
import { Link } from "react-router-dom";
import { CHAINS } from "@ysk-mint/config";

const launchEvent = parseAbiItem(
  "event Launch(address indexed token, address indexed deployer, bytes32 indexed salt, string name, string symbol, uint8 supplyMode)",
);

export function MePage() {
  const { t } = useTranslation();
  const { address } = useAccount();
  const client = usePublicClient();
  const [rows, setRows] = useState<{ token: `0x${string}`; name: string }[]>([]);
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
          })),
        );
      })
      .catch(() => setRows([]));
  }, [client, address, contracts]);

  return (
    <section className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-bold">{t("me.title")}</h1>
      <p className="mt-2 text-sm text-text-sub">{t("me.body")}</p>
      {!isConfigured(contracts) ? <p className="mt-4 text-sm text-amber-800">{t("me.noFactory")}</p> : null}
      <ul className="mt-6 space-y-2">
        {rows.map((r) => (
          <li key={r.token} className="rounded-xl border border-border bg-white p-3 text-sm">
            <Link className="font-medium text-brand-blue" to={`/token/${chainId}/${r.token}`}>
              {r.name || r.token}
            </Link>
            <p className="font-mono text-xs break-all">{r.token}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
