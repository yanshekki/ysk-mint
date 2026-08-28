import { useTranslation } from "react-i18next";
import { useReadContract } from "wagmi";
import { CHAINS, liquidityLockerAbi, yskOftAbi, launchContracts } from "@ysk-mint/sdk";
import { Link } from "react-router-dom";
import { useWizard } from "./store.ts";
import { homeEvm } from "../../lib/launchTargets.ts";
import { shortAddr } from "../../lib/lendFormat.ts";

const ZERO = "0x0000000000000000000000000000000000000000";

export function StepSuccess() {
  const { t } = useTranslation();
  const w = useWizard();
  const home = homeEvm(w.chains);
  const contracts = home ? launchContracts(home.key) : undefined;
  const chainId = home?.chainId;
  const token = (home ? w.perChain[home.key]?.token : undefined) ?? w.tokenAddress;
  const lockId = w.lockId ? BigInt(w.lockId) : undefined;
  const explore = home?.explorer.replace(/\/$/, "");
  const deployed = Object.entries(w.perChain).flatMap(([key, v]) => {
    const c = CHAINS[Number(key) as keyof typeof CHAINS];
    return c && v.token ? [{ chain: c, token: v.token }] : [];
  });
  const usedMockLp = deployed.some((row) => {
    const cfg = launchContracts(row.chain.key);
    return row.chain.testnet && (!cfg || cfg.v2Router === ZERO);
  });

  const name = useReadContract({
    address: token,
    abi: yskOftAbi,
    functionName: "name",
    chainId,
    query: { enabled: Boolean(token && chainId) },
  });
  const supply = useReadContract({
    address: token,
    abi: yskOftAbi,
    functionName: "totalSupply",
    chainId,
    query: { enabled: Boolean(token && chainId) },
  });
  const lock = useReadContract({
    address: contracts?.locker,
    abi: liquidityLockerAbi,
    functionName: "getLock",
    args: lockId !== undefined ? [lockId] : undefined,
    chainId,
    query: { enabled: Boolean(contracts?.locker && chainId) && lockId !== undefined },
  });

  return (
    <>
      <div className="me-card-head">
        <div>
          <b>{t("wizard.success.title")}</b>
          <p className="field-note" style={{ margin: "4px 0 0" }}>
            {t("wizard.success.reread")}
            {home ? ` · ${home.name}` : ""}
          </p>
        </div>
      </div>
      <div className="lend-stats" style={{ padding: "12px 16px 0" }}>
        <div className="lend-stat">
          <b>{name.data ?? "…"}</b>
          <span>{t("wizard.success.token")}</span>
        </div>
        <div className="lend-stat">
          <b className="num">{token ? shortAddr(token) : "—"}</b>
          <span>{home?.short ?? "EVM"}</span>
        </div>
        <div className="lend-stat">
          <b className="num">{supply.data?.toString() ?? "…"}</b>
          <span>{t("wizard.basics.supply")}</span>
        </div>
        <div className="lend-stat">
          <b className="num">{lock.data ? lock.data.amount.toString() : "—"}</b>
          <span>{t("wizard.success.lock")}</span>
        </div>
      </div>
      {deployed.length ? (
        <div className="me-list" style={{ padding: "0 0 8px" }} aria-label={t("wizard.success.chains")}>
          {deployed.map((row) => {
            const ex = row.chain.explorer.replace(/\/$/, "");
            return (
              <div key={row.chain.key} className="me-token">
                <span className="holding-meta">
                  <b>{row.chain.name}</b>
                  <span className="num">{shortAddr(row.token)}</span>
                </span>
                {ex ? (
                  <a className="me-pool-btn me-pool-btn-explore" href={`${ex}/token/${row.token}`} target="_blank" rel="noreferrer">
                    {t("transfer.explorer")}
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {usedMockLp ? <p className="set-note set-note-pad">{t("wizard.execute.mockLp")}</p> : null}
      <div className="xfer-acts">
        {token && chainId ? (
          <Link className="me-pool-btn me-pool-btn-explore" to={`/token/${chainId}/${token}`}>
            {t("wizard.openToken")}
          </Link>
        ) : null}
        {token && explore ? (
          <a className="me-pool-btn me-pool-btn-explore" href={`${explore}/token/${token}`} target="_blank" rel="noreferrer">
            {t("transfer.explorer")}
          </a>
        ) : null}
        <Link className="me-pool-btn me-pool-btn-dex" to="/transfer">
          {t("wizard.goTransfer")}
        </Link>
      </div>
    </>
  );
}
