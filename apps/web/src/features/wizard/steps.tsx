import { useEffect } from "react";
import { LockMode, OwnershipAction, SupplyMode } from "@ysk-mint/sdk";
import { featuredChains, testnetChains } from "@ysk-mint/config";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { useWizard } from "./store.ts";
import { WalletDesk } from "../wallet/WalletDesk.tsx";
import { ChipGroup } from "../../shared/ui/ChipGroup.tsx";
import { OptionCard, OptionGrid } from "../../shared/ui/OptionCard.tsx";
import { Badge } from "../../shared/ui/TokenRow.tsx";
import { useNativeWallets } from "../../lib/nativeWallets.ts";
import { homeEvm, selectedChains, undeployedEvm } from "../../lib/launchTargets.ts";
import { STEP_FLOW, decimalsOptions, defaultDecimals, hasEvm, selectedVms } from "../../lib/wizardFlow.ts";
import {
  LOCK_CARDS,
  LP_BPS,
  NATIVE_PRESETS,
  SUPPLY_PRESETS,
  TAX_BPS,
  WALLET_BPS,
  lpTokenAmount,
} from "./presets.ts";

export function StepWallet() {
  return <WalletDesk />;
}

export function StepBasics() {
  const { t } = useTranslation();
  const w = useWizard();
  const { isConnected } = useAccount();
  const native = useNativeWallets();
  const vms = selectedVms(w.chains);
  const decs = decimalsOptions(w.chains);
  const picked = selectedChains(w.chains);
  const missing = undeployedEvm(w.chains);

  useEffect(() => {
    if (!decs.includes(w.decimals)) {
      const next = defaultDecimals(w.chains);
      if (next !== w.decimals) w.set({ decimals: next });
    }
  }, [decs, w.chains, w.decimals, w]);

  const gaps: string[] = [];
  if (vms.includes("evm") && !isConnected) gaps.push(t("wizard.basics.gapWalletEvm"));
  if (vms.includes("near") && !native.nearAccount) gaps.push(t("wizard.basics.gapWalletNear"));
  if (vms.includes("cardano") && !native.cardanoAddress) gaps.push(t("wizard.basics.gapWalletAda"));
  if (vms.includes("solana") && !native.solanaAddress) gaps.push(t("wizard.basics.gapWalletSol"));
  if (missing.length) gaps.push(t("wizard.basics.gapUndeployedEvm", { names: missing.map((c) => c.short).join("、") }));
  if (vms.includes("near")) gaps.push(t("wizard.basics.gapNearFactory"));
  if (vms.includes("cardano")) gaps.push(t("wizard.basics.gapAdaFactory"));
  if (vms.includes("solana")) gaps.push(t("wizard.basics.gapSolProgram"));
  if (vms.includes("evm") && vms.includes("cardano") && !decs.includes(0)) gaps.push(t("wizard.basics.gapAdaDecimals"));
  if (vms.includes("evm")) gaps.push(t("wizard.basics.gapSpoke"));
  if (!vms.includes("evm") && vms.length) gaps.push(t("wizard.basics.gapNativeNoEvm"));

  const nameHint =
    vms.includes("evm") ? t("wizard.basics.nameHintEvm") : vms.includes("near") ? t("wizard.basics.nameHintNear") : vms.includes("cardano") ? t("wizard.basics.nameHintAda") : vms.includes("solana") ? t("wizard.basics.nameHintSol") : t("wizard.basics.nameHintEvm");
  const symbolHint =
    vms.includes("cardano") && !vms.includes("evm") ? t("wizard.basics.symbolHintAda") : t("wizard.basics.symbolHint");
  const decimalsHint = vms.includes("evm") ? t("wizard.basics.decimalsHintEvm") : t("wizard.basics.decimalsHintNative");

  return (
    <div className="grid gap-5">
      <p className="field-note">{t("wizard.basics.lede")}</p>
      <div className="basics-chain-chips">
        {picked.map((c) => (
          <span key={c.key} className="basics-chip">
            {c.short}
          </span>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[14px] font-bold">
          {t("wizard.basics.name")}
          <input
            className="field-text mt-1"
            maxLength={32}
            value={w.name}
            onChange={(e) => w.set({ name: e.target.value })}
          />
          <span className="field-note">{nameHint}</span>
        </label>
        <label className="text-[14px] font-bold">
          {t("wizard.basics.symbol")}
          <input
            className="field-text mt-1 num uppercase"
            maxLength={11}
            value={w.symbol}
            onChange={(e) => w.set({ symbol: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
          />
          <span className="field-note">{symbolHint}</span>
        </label>
      </div>
      <div>
        <p className="mb-2 text-[14px] font-bold">{t("wizard.basics.decimals")}</p>
        <ChipGroup
          ariaLabel="decimals"
          value={w.decimals}
          onChange={(decimals) => w.set({ decimals })}
          options={decs.map((d) => ({ value: d, label: String(d) }))}
        />
        <p className="field-note mt-2">{decimalsHint}</p>
      </div>
      <div>
        <p className="mb-2 text-[14px] font-bold">{t("wizard.basics.supply")}</p>
        <ChipGroup
          ariaLabel="supply"
          value={w.totalSupply}
          onChange={(totalSupply) => w.set({ totalSupply })}
          options={SUPPLY_PRESETS.map((s) => ({ value: s.value, label: s.label }))}
        />
        <p className="field-note mt-2">{t("wizard.basics.supplyHint")}</p>
      </div>
      <div className="vm-cards">
        {vms.map((vm) => (
          <article key={vm} className="vm-card">
            <h3>{t(`wizard.basics.vm.${vm}.title`)}</h3>
            <p>{t(`wizard.basics.vm.${vm}.body`)}</p>
          </article>
        ))}
      </div>
      {gaps.length ? (
        <div className="gap-box">
          <p className="gap-box-title">{t("wizard.basics.gapsTitle")}</p>
          <ul>
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function StepTokenomics() {
  const { t } = useTranslation();
  const w = useWizard();
  if (!hasEvm(w.chains)) {
    return <p className="field-note">{t("wizard.tokenomics.nativeOnly")}</p>;
  }
  return (
    <div className="grid gap-5">
      <p className="field-note">{t("wizard.tokenomics.evmOnlyNote")}</p>
      <div>
        <p className="mb-2 text-[14px] font-bold">{t("wizard.tokenomics.supplyMode")}</p>
        <OptionGrid>
          <OptionCard
            selected={w.supplyMode === SupplyMode.Fixed}
            title={t("wizard.tokenomics.fixed")}
            hint={t("wizard.tokenomics.fixedHint")}
            onSelect={() => w.set({ supplyMode: SupplyMode.Fixed })}
          />
          <OptionCard
            selected={w.supplyMode === SupplyMode.Mintable}
            title={t("wizard.tokenomics.mintable")}
            hint={t("wizard.tokenomics.mintableHint")}
            onSelect={() => w.set({ supplyMode: SupplyMode.Mintable })}
          />
        </OptionGrid>
      </div>
      <div>
        <p className="mb-2 text-[14px] font-bold">{t("wizard.tokenomics.ownership")}</p>
        <OptionGrid>
          {(
            [
              [OwnershipAction.Keep, "keep"],
              [OwnershipAction.Renounce, "renounce"],
              [OwnershipAction.TransferSafe, "safe"],
              [OwnershipAction.TransferTimelock, "timelock"],
            ] as const
          ).map(([v, key]) => (
            <OptionCard
              key={v}
              selected={w.ownershipAction === v}
              title={t(`wizard.tokenomics.${key}`)}
              hint={t(`wizard.tokenomics.${key}Hint`)}
              onSelect={() => w.set({ ownershipAction: v })}
            />
          ))}
        </OptionGrid>
        {w.ownershipAction === OwnershipAction.TransferSafe ||
        w.ownershipAction === OwnershipAction.TransferTimelock ? (
          <input
            className="field-text mt-3 num"
            placeholder="0x…"
            value={w.ownershipTarget}
            onChange={(e) => w.set({ ownershipTarget: e.target.value })}
          />
        ) : null}
      </div>
      <div>
        <p className="mb-2 text-[14px] font-bold">{t("wizard.tokenomics.modules")}</p>
        <OptionGrid>
          <OptionCard
            selected={w.modulePause}
            title={t("wizard.tokenomics.pause")}
            hint={t("wizard.tokenomics.pauseHint")}
            onSelect={() => w.set({ modulePause: !w.modulePause })}
          />
          <OptionCard
            selected={w.moduleMaxTx}
            title={t("wizard.tokenomics.maxTx")}
            hint={t("wizard.tokenomics.maxTxHint")}
            onSelect={() => w.set({ moduleMaxTx: !w.moduleMaxTx })}
          />
          <OptionCard
            selected={w.moduleTax}
            title={t("wizard.tokenomics.tax")}
            hint={t("wizard.tokenomics.taxHint")}
            onSelect={() => w.set({ moduleTax: !w.moduleTax })}
          />
        </OptionGrid>
        {w.moduleMaxTx ? (
          <div className="mt-3">
            <p className="mb-2 text-[14px] font-bold">{t("wizard.tokenomics.maxWallet")}</p>
            <ChipGroup
              ariaLabel="max-wallet"
              value={w.maxWalletBps}
              onChange={(maxWalletBps) => w.set({ maxWalletBps })}
              options={WALLET_BPS.map((x) => ({ value: x.value, label: x.label }))}
            />
          </div>
        ) : null}
        {w.moduleTax ? (
          <div className="mt-3">
            <p className="mb-2 text-[14px] font-bold">{t("wizard.tokenomics.taxBps")}</p>
            <ChipGroup
              ariaLabel="tax"
              value={w.taxBps}
              onChange={(taxBps) => w.set({ taxBps })}
              options={TAX_BPS.map((x) => ({ value: x.value, label: x.label }))}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function StepChains() {
  const { t } = useTranslation();
  const w = useWizard();
  return (
    <div className="space-y-3">
      <p className="text-[15px] text-text-sub">{t("wizard.chains.hint")}</p>
      <div className="opt-grid">
        {featuredChains().map((c) => {
          const on = w.chains.includes(c.key);
          const live = c.enabled;
          const hint =
            c.vm === "near"
              ? t("wizard.chains.nearHint")
              : c.vm === "cardano"
                ? t("wizard.chains.adaHint")
                : c.vm === "solana"
                  ? t("wizard.chains.solHint")
                  : `EID ${c.eid}${live ? "" : ` · ${t("wizard.chains.disabled")}`}`;
          return (
            <OptionCard
              key={c.key}
              selected={on && live}
              disabled={!live}
              title={c.name}
              hint={hint}
              onSelect={() => {
                if (!live) return;
                w.set({
                  chains: on ? w.chains.filter((k) => k !== c.key) : [...w.chains, c.key],
                });
              }}
            />
          );
        })}
      </div>
      <p className="text-[14px] font-bold text-text-muted">{t("wizard.chains.testnets")}</p>
      <div className="opt-grid">
        {testnetChains().map((c) => {
          const on = w.chains.includes(c.key);
          return (
            <OptionCard
              key={c.key}
              selected={on}
              title={c.name}
              hint={
                c.vm === "near"
                  ? t("wizard.chains.nearHint")
                  : c.vm === "cardano"
                    ? t("wizard.chains.adaHint")
                    : c.vm === "solana"
                      ? t("wizard.chains.solHint")
                      : `EID ${c.eid}`
              }
              onSelect={() => {
                w.set({
                  chains: on ? w.chains.filter((k) => k !== c.key) : [...w.chains, c.key],
                });
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function StepLiquidity() {
  const { t } = useTranslation();
  const w = useWizard();
  const lpAmt = lpTokenAmount(w.totalSupply, w.lpBps);
  const home = homeEvm(w.chains);
  const nat = home?.nativeSymbol ?? "ETH";
  if (!hasEvm(w.chains)) {
    return <p className="field-note">{t("wizard.liquidity.nativeOnly")}</p>;
  }
  return (
    <div className="grid gap-5">
      <div>
        <p className="mb-2 text-[14px] font-bold">{t("wizard.liquidity.tokenBps")}</p>
        <ChipGroup
          ariaLabel="lp-bps"
          value={w.lpBps}
          onChange={(lpBps) => w.set({ lpBps })}
          options={LP_BPS.map((x) => ({ value: x.value, label: x.label }))}
        />
        <p className="mt-2 num text-[14px] text-text-muted">
          {lpAmt} / {w.totalSupply}
        </p>
      </div>
      <div>
        <p className="mb-2 text-[14px] font-bold">{t("wizard.liquidity.nativeAmount")}</p>
        <ChipGroup
          ariaLabel="lp-native"
          value={w.lpNativeAmount}
          onChange={(lpNativeAmount) => w.set({ lpNativeAmount })}
          options={NATIVE_PRESETS.map((v) => ({ value: v, label: `${v} ${nat}` }))}
        />
      </div>
      <div>
        <p className="mb-2 text-[14px] font-bold">{t("wizard.liquidity.mode")}</p>
        <div className="opt-grid">
          {LOCK_CARDS.map((c) => (
            <OptionCard
              key={`${c.mode}-${c.duration}`}
              selected={w.lockMode === c.mode && (c.mode === LockMode.Burn || w.lockDuration === c.duration)}
              title={t(`wizard.liquidity.${c.titleKey}`)}
              hint={t(`wizard.liquidity.${c.hintKey}`)}
              onSelect={() => w.set({ lockMode: c.mode, lockDuration: c.duration })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function StepReview() {
  const { t } = useTranslation();
  const w = useWizard();
  const home = homeEvm(w.chains);
  const nat = home?.nativeSymbol ?? selectedChains(w.chains)[0]?.nativeSymbol ?? "";
  const evm = hasEvm(w.chains);
  return (
    <div className="space-y-3">
      <div className="token-row">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-green text-xs font-black text-white">
          {(w.symbol || "??").slice(0, 2)}
        </div>
        <div>
          <p className="text-[15px] font-bold">
            {w.name || "—"} <span className="text-text-muted">{w.symbol}</span>
          </p>
          <p className="num text-[13px] text-text-muted">
            {w.totalSupply} · {w.decimals} dec
            {evm ? ` · LP ${w.lpBps / 100}% + ${w.lpNativeAmount} ${nat}` : ""}
          </p>
        </div>
        <Badge kind={w.supplyMode === SupplyMode.Fixed ? "ok" : "warn"}>
          {w.supplyMode === SupplyMode.Fixed ? "FIXED" : "MINT"}
        </Badge>
      </div>
      <ul className="space-y-1 text-[14px] text-text-sub">
        <li>{t("wizard.review.checklist")}</li>
        {evm ? <li>{w.supplyMode === SupplyMode.Fixed ? t("wizard.review.fixed") : t("wizard.review.mintableWarn")}</li> : null}
        {evm ? <li>{t("wizard.review.lock")}</li> : <li>{t("wizard.review.nativeNoLp")}</li>}
        <li>{t("wizard.review.unaudited")}</li>
        <li>{t("wizard.review.onchainOnly")}</li>
      </ul>
    </div>
  );
}

export { StepOmnichain } from "./OmnichainDesk.tsx";

export const STEP_LABELS = [...STEP_FLOW];
