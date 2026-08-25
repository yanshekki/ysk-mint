import { useTranslation } from "react-i18next";
import { useAccount, useConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { useEffect, useMemo, useState } from "react";
import { parseAbiItem } from "viem";
import { isConfigured, launchContracts, evmEnabledChains } from "@ysk-mint/sdk";
import { Link } from "react-router-dom";
import { Badge, TokenRow } from "../../shared/ui/TokenRow.tsx";

const launchEvent = parseAbiItem(
  "event Launch(address indexed token, address indexed deployer, bytes32 indexed salt, string name, string symbol, uint8 supplyMode)",
);

type Row = { token: `0x${string}`; name: string; symbol: string; chainId: number; chain: string };

export function MePage() {
  const { t } = useTranslation();
  const { address } = useAccount();
  const config = useConfig();
  const [rows, setRows] = useState<Row[]>([]);
  const live = useMemo(
    () => evmEnabledChains().filter((c) => isConfigured(launchContracts(c.key))),
    [],
  );

  useEffect(() => {
    if (!address || live.length === 0) {
      setRows([]);
      return;
    }
    let cancelled = false;
    void Promise.all(
      live.map(async (c) => {
        const contracts = launchContracts(c.key);
        if (!isConfigured(contracts)) return [];
        const client = getPublicClient(config, { chainId: c.chainId });
        if (!client) return [];
        try {
          const logs = await client.getLogs({
            address: contracts.factory,
            event: launchEvent,
            args: { deployer: address },
            fromBlock: 0n,
            toBlock: "latest",
          });
          return logs.map((l) => ({
            token: l.args.token as `0x${string}`,
            name: l.args.name ?? "",
            symbol: l.args.symbol ?? "",
            chainId: c.chainId,
            chain: c.short,
          }));
        } catch {
          return [];
        }
      }),
    ).then((parts) => {
      if (!cancelled) setRows(parts.flat());
    });
    return () => {
      cancelled = true;
    };
  }, [address, config, live]);

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">Portfolio</p>
          <h1>{t("me.title")}</h1>
          <p className="mt-1 text-[15px] text-text-sub">{t("me.body")}</p>
        </div>
      </div>
      <div className="table-wrap" style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
        {live.length === 0 ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[15px] text-amber-900">{t("me.noFactory")}</p>
        ) : null}
        {rows.length === 0 ? (
          <div className="empty fill">{t("me.noFactory")}</div>
        ) : (
          rows.map((r) => (
            <Link key={`${r.chainId}-${r.token}`} to={`/token/${r.chainId}/${r.token}`}>
              <TokenRow
                title={`${r.symbol || "TKN"} · ${r.name}`}
                subtitle={`${r.chain} · ${r.token}`}
                right={<Badge kind="info">OFT</Badge>}
              />
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
