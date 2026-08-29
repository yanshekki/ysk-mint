import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CHAINS as CHAIN_MAP, featuredChains, testnetChains } from "@ysk-mint/config";
import { GLOBAL_RPC_PROVIDERS } from "../../lib/rpcCatalog.ts";
import { rpcActiveLabel, subscribeRpcSession } from "../../lib/rpcPool.ts";
import { chainIcon } from "../../lib/chainIcon.ts";
import { useUserSettings } from "../../lib/userSettings.ts";
import { SetItem, SetSwitch } from "./SetControls.tsx";
import { RpcChainRow } from "./RpcChainRow.tsx";
import { chainHits, rpcBadgeLabel, rpcProvLabel } from "./rpcLabels.ts";

const CHAINS = featuredChains().filter((c) => !c.testnet);

function useRpcSession() {
  const [, setN] = useState(0);
  useEffect(() => subscribeRpcSession(() => setN((n) => n + 1)), []);
}

function RpcGlobalBar() {
  const { t } = useTranslation();
  useRpcSession();
  const strategy = useUserSettings((s) => s.rpcStrategy);
  const provider = useUserSettings((s) => s.rpcProvider);
  const patch = useUserSettings((s) => s.patch);
  const avaxName = rpcBadgeLabel(rpcActiveLabel(43114), t);

  return (
    <div className="set-rpc-global">
      <p className="set-note">{t("settings.rpcHint")}</p>
      <SetItem title={t("settings.rpcStrategy")} hint={t("settings.rpcStrategyHint")}>
        <div className="me-chips">
          {(["preferred", "random"] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={`me-chip ${strategy === id ? "me-chip-on" : ""}`}
              onClick={() => patch({ rpcStrategy: id })}
            >
              {id === "preferred" ? t("settings.rpcPreferred") : t("settings.rpcRandom")}
            </button>
          ))}
        </div>
      </SetItem>
      {strategy === "preferred" ? (
        <SetItem title={t("settings.rpcProvider")} hint={t("settings.rpcHint")}>
          <div className="me-chips">
            {GLOBAL_RPC_PROVIDERS.map((id) => (
              <button
                key={id}
                type="button"
                className={`me-chip ${provider === id ? "me-chip-on" : ""}`}
                onClick={() => patch({ rpcStrategy: "preferred", rpcProvider: id })}
              >
                {rpcProvLabel(id, t)}
              </button>
            ))}
          </div>
        </SetItem>
      ) : null}
      {avaxName ? <p className="set-note">{t("settings.rpcNow", { chain: "AVAX", name: avaxName })}</p> : null}
    </div>
  );
}

export function RpcSettings() {
  const { t } = useTranslation();
  const s = useUserSettings();
  const [enableQ, setEnableQ] = useState("");
  const [rpcQ, setRpcQ] = useState("");
  const [showTestnets, setShowTestnets] = useState(false);

  const onCount = CHAINS.length - s.disabledChains.filter((id) => CHAINS.some((c) => c.chainId === id)).length;
  const enableNeedle = enableQ.trim().toLowerCase();
  const rpcNeedle = rpcQ.trim().toLowerCase();

  const visibleChains = useMemo(() => CHAINS.filter((c) => chainHits(c, enableNeedle)), [enableNeedle]);
  const rpcMainnets = useMemo(() => {
    const featured = featuredChains().filter((c) => c.enabled && !c.testnet);
    const seen = new Set(featured.map((c) => c.chainId));
    const rest = Object.values(CHAIN_MAP)
      .filter((c) => c.enabled && !c.testnet && !seen.has(c.chainId))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [...featured, ...rest].filter((c) => chainHits(c, rpcNeedle));
  }, [rpcNeedle]);
  const rpcTestnets = useMemo(() => testnetChains().filter((c) => chainHits(c, rpcNeedle)), [rpcNeedle]);

  return (
    <>
      <section className="me-card" role="tabpanel">
        <div className="me-card-head">
          <b>{t("settings.chains")}</b>
          <input
            className="me-filter"
            type="text"
            value={enableQ}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setEnableQ(e.target.value)}
            placeholder={t("settings.chainSearch")}
            aria-label={t("settings.chainSearch")}
          />
          <span className="me-count">{t("settings.chainsOn", { on: onCount, total: CHAINS.length })}</span>
        </div>
        <div className="set-chain-bar">
          <p className="set-note">{t("settings.chainsHint")}</p>
          <button type="button" className="me-pool-btn me-pool-btn-explore" onClick={() => s.patch({ disabledChains: [] })}>
            {t("settings.allOn")}
          </button>
          <button
            type="button"
            className="me-pool-btn me-pool-btn-explore"
            onClick={() => s.patch({ disabledChains: CHAINS.map((c) => c.chainId) })}
          >
            {t("settings.allOff")}
          </button>
        </div>
        {onCount === 0 ? <p className="me-card-empty">{t("settings.chainsNone")}</p> : null}
        {visibleChains.length === 0 ? (
          <p className="me-card-empty">{t("settings.chainEmpty")}</p>
        ) : (
          <div className="me-list set-chain-list">
            {visibleChains.map((c) => {
              const on = !s.disabledChains.includes(c.chainId);
              return (
                <button
                  key={c.chainId}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  className={`me-token ${on ? "" : "me-token-zero"}`}
                  onClick={() => s.setChainEnabled(c.chainId, !on)}
                >
                  <span className="holding-ico-wrap">
                    <img src={chainIcon(c)} alt="" className="holding-ico" />
                  </span>
                  <div className="holding-meta">
                    <b>{c.name}</b>
                    <span>
                      {c.short} · {on ? t("settings.chainOn") : t("settings.chainOff")}
                    </span>
                  </div>
                  <SetSwitch on={on} />
                </button>
              );
            })}
          </div>
        )}
      </section>
      <section className="me-card" id="rpc">
        <div className="me-card-head">
          <b>{t("settings.rpc")}</b>
          <input
            className="me-filter"
            type="text"
            value={rpcQ}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setRpcQ(e.target.value)}
            placeholder={t("settings.rpcSearch")}
            aria-label={t("settings.rpcSearch")}
          />
        </div>
        <RpcGlobalBar />
        {rpcMainnets.length === 0 && rpcTestnets.length === 0 ? (
          <p className="me-card-empty">{t("settings.chainEmpty")}</p>
        ) : rpcMainnets.length ? (
          <div className="set-rpc-list">
            {rpcMainnets.map((c) => (
              <RpcChainRow key={c.chainId} chain={c} />
            ))}
          </div>
        ) : null}
        {rpcTestnets.length ? (
          <>
            <div className="set-rpc-acts set-rpc-testnets">
              {rpcNeedle ? (
                <span className="me-count">{t("settings.rpcTestnets")}</span>
              ) : (
                <>
                  <button type="button" className="me-pool-btn me-pool-btn-explore" onClick={() => setShowTestnets((v) => !v)}>
                    {showTestnets ? t("settings.rpcHideTestnets") : t("settings.rpcShowTestnets")}
                  </button>
                  <span className="me-count">{t("settings.rpcTestnets")}</span>
                </>
              )}
            </div>
            {showTestnets || rpcNeedle ? (
              <div className="set-rpc-list">
                {rpcTestnets.map((c) => (
                  <RpcChainRow key={c.chainId} chain={c} />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </>
  );
}
