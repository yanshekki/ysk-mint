import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CHAINS as CHAIN_MAP, featuredChains, testnetChains, type ChainDefinition } from "@ysk-mint/config";
import {
  DEFI_SCAN_KINDS,
  chainPresetOf,
  defiPresetOf,
  disabledForChainPreset,
  disabledForDefiPreset,
  isCoreChainId,
  type DefiScanKind,
  type ScanPreset,
} from "../../lib/defiScan.ts";
import { GLOBAL_RPC_PROVIDERS } from "../../lib/rpcCatalog.ts";
import { rpcActiveLabel, subscribeRpcSession } from "../../lib/rpcPool.ts";
import { chainIcon } from "../../lib/chainIcon.ts";
import { useUserSettings } from "../../lib/userSettings.ts";
import { SetItem, SetSwitch, SetToggle } from "./SetControls.tsx";
import { RpcChainRow } from "./RpcChainRow.tsx";
import { chainHits, rpcBadgeLabel, rpcProvLabel } from "./rpcLabels.ts";

const CHAINS = featuredChains().filter((c) => !c.testnet);

function useRpcSession() {
  const [, setN] = useState(0);
  useEffect(() => subscribeRpcSession(() => setN((n) => n + 1)), []);
}

function ScanPresetBar({ hint, active, onPick }: { hint: string; active: ScanPreset | null; onPick: (preset: ScanPreset) => void }) {
  const { t } = useTranslation();
  const btn = (id: ScanPreset, label: string) => (
    <button type="button" className={`me-chip ${active === id ? "me-chip-on" : ""}`} onClick={() => onPick(id)}>
      {label}
    </button>
  );
  return (
    <div className="set-chain-bar">
      <p className="set-note">{hint}</p>
      <div className="me-chips">
        {btn("core", t("settings.scanCore"))}
        {btn("extra", t("settings.scanExtra"))}
        {btn("all", t("settings.allOn"))}
        {btn("none", t("settings.allOff"))}
      </div>
    </div>
  );
}

function ChainEnableRow({ chain, on }: { chain: ChainDefinition; on: boolean }) {
  const { t } = useTranslation();
  const setChainEnabled = useUserSettings((s) => s.setChainEnabled);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`me-token ${on ? "" : "me-token-zero"}`}
      onClick={() => setChainEnabled(chain.chainId, !on)}
    >
      <span className="holding-ico-wrap">
        <img src={chainIcon(chain)} alt="" className="holding-ico" />
      </span>
      <div className="holding-meta">
        <b>{chain.name}</b>
        <span>
          {chain.short} · {on ? t("settings.chainOn") : t("settings.chainOff")}
        </span>
      </div>
      <SetSwitch on={on} />
    </button>
  );
}

function DefiScanCard() {
  const { t } = useTranslation();
  const disabledDefi = useUserSettings((s) => s.disabledDefi);
  const setDefiEnabled = useUserSettings((s) => s.setDefiEnabled);
  const patch = useUserSettings((s) => s.patch);
  const onCount = DEFI_SCAN_KINDS.length - disabledDefi.filter((k) => (DEFI_SCAN_KINDS as readonly string[]).includes(k)).length;
  const core = DEFI_SCAN_KINDS.filter((k) => k.endsWith("Core"));
  const extra = DEFI_SCAN_KINDS.filter((k) => k.endsWith("Extra"));
  return (
    <section className="me-card">
      <div className="me-card-head">
        <b>{t("settings.defi")}</b>
        <span className="me-count">{t("settings.chainsOn", { on: onCount, total: DEFI_SCAN_KINDS.length })}</span>
      </div>
      <ScanPresetBar
        hint={t("settings.defiHint")}
        active={defiPresetOf(disabledDefi)}
        onPick={(preset) => patch({ disabledDefi: disabledForDefiPreset(preset) })}
      />
      <p className="chain-group-title set-scan-group">{t("settings.scanCore")}</p>
      {core.map((kind) => (
        <SetToggle
          key={kind}
          title={t(`settings.defiKind.${kind}`)}
          hint={t(`settings.defiKindHint.${kind}`)}
          on={!disabledDefi.includes(kind)}
          onChange={(on) => setDefiEnabled(kind as DefiScanKind, on)}
        />
      ))}
      <p className="chain-group-title set-scan-group">{t("settings.scanExtra")}</p>
      {extra.map((kind) => (
        <SetToggle
          key={kind}
          title={t(`settings.defiKind.${kind}`)}
          hint={t(`settings.defiKindHint.${kind}`)}
          on={!disabledDefi.includes(kind)}
          onChange={(on) => setDefiEnabled(kind as DefiScanKind, on)}
        />
      ))}
    </section>
  );
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
  const coreVisible = useMemo(() => visibleChains.filter((c) => isCoreChainId(c.chainId)), [visibleChains]);
  const extraVisible = useMemo(() => visibleChains.filter((c) => !isCoreChainId(c.chainId)), [visibleChains]);
  const searching = Boolean(enableNeedle);
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
        <ScanPresetBar
          hint={t("settings.chainsHint")}
          active={chainPresetOf(s.disabledChains)}
          onPick={(preset) => s.patch({ disabledChains: disabledForChainPreset(preset) })}
        />
        {onCount === 0 ? <p className="me-card-empty">{t("settings.chainsNone")}</p> : null}
        {visibleChains.length === 0 ? (
          <p className="me-card-empty">{t("settings.chainEmpty")}</p>
        ) : searching ? (
          <div className="me-list set-chain-list">
            {visibleChains.map((c) => (
              <ChainEnableRow key={c.chainId} chain={c} on={!s.disabledChains.includes(c.chainId)} />
            ))}
          </div>
        ) : (
          <div className="me-list set-chain-list">
            {coreVisible.length ? <p className="chain-group-title set-scan-group">{t("settings.scanCore")}</p> : null}
            {coreVisible.map((c) => (
              <ChainEnableRow key={c.chainId} chain={c} on={!s.disabledChains.includes(c.chainId)} />
            ))}
            {extraVisible.length ? <p className="chain-group-title set-scan-group">{t("settings.scanExtra")}</p> : null}
            {extraVisible.map((c) => (
              <ChainEnableRow key={c.chainId} chain={c} on={!s.disabledChains.includes(c.chainId)} />
            ))}
          </div>
        )}
      </section>
      <DefiScanCard />
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
