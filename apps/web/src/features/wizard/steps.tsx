import { CHAINS, LaunchStep, LockMode, OwnershipAction, SupplyMode } from "@ysk-mint/sdk";
import { featuredChains, testnetChains } from "@ysk-mint/config";
import { useAccount } from "wagmi";
import { useTranslation } from "react-i18next";
import { useWizard } from "./store.ts";
import { ConnectBar } from "../wallet/ConnectBar.tsx";
import { ChipGroup } from "../../shared/ui/ChipGroup.tsx";
import { OptionCard, OptionGrid } from "../../shared/ui/OptionCard.tsx";
import { Dropzone } from "../../shared/ui/Dropzone.tsx";
import { Badge } from "../../shared/ui/TokenRow.tsx";
import {
  DECIMALS,
  LOCK_CARDS,
  LP_BPS,
  NATIVE_PRESETS,
  SUPPLY_PRESETS,
  TAX_BPS,
  WALLET_BPS,
  lpTokenAmount,
} from "./presets.ts";

export function StepWallet() {
  const { t } = useTranslation();
  const { isConnected, address } = useAccount();
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-text-sub">{t("wizard.wallet.need")}</p>
      <ConnectBar showHint />
      <div className="token-row">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-bg-subtle text-xs font-black">W</div>
        <div>
          <p className="text-[13px] font-bold">{isConnected ? t("wizard.wallet.ready") : t("wizard.wallet.idle")}</p>
          <p className="num truncate text-[11px] text-text-muted">{isConnected ? address : "—"}</p>
        </div>
        <Badge kind={isConnected ? "ok" : "warn"}>{isConnected ? "ON" : "OFF"}</Badge>
      </div>
    </div>
  );
}

export function StepBasics() {
  const { t } = useTranslation();
  const w = useWizard();
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[12px] font-bold">
          {t("wizard.basics.name")}
          <input
            className="field-text mt-1"
            maxLength={32}
            value={w.name}
            onChange={(e) => w.set({ name: e.target.value })}
          />
        </label>
        <label className="text-[12px] font-bold">
          {t("wizard.basics.symbol")}
          <input
            className="field-text mt-1 num uppercase"
            maxLength={11}
            value={w.symbol}
            onChange={(e) => w.set({ symbol: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
          />
        </label>
      </div>
      <div>
        <p className="mb-2 text-[12px] font-bold">{t("wizard.basics.decimals")}</p>
        <ChipGroup
          ariaLabel="decimals"
          value={w.decimals}
          onChange={(decimals) => w.set({ decimals })}
          options={DECIMALS.map((d) => ({ value: d, label: String(d) }))}
        />
      </div>
      <div>
        <p className="mb-2 text-[12px] font-bold">{t("wizard.basics.supply")}</p>
        <ChipGroup
          ariaLabel="supply"
          value={w.totalSupply}
          onChange={(totalSupply) => w.set({ totalSupply })}
          options={SUPPLY_PRESETS.map((s) => ({ value: s.value, label: s.label }))}
        />
      </div>
      <div>
        <p className="mb-2 text-[12px] font-bold">{t("wizard.basics.logo")}</p>
        <Dropzone preview={w.logoUri} onFile={(logoUri) => w.set({ logoUri })} />
      </div>
      <button type="button" className="text-left text-[12px] font-bold text-brand-blue" onClick={() => w.set({ showAdvanced: !w.showAdvanced })}>
        {w.showAdvanced ? t("wizard.basics.hideAdvanced") : t("wizard.basics.showAdvanced")}
      </button>
      {w.showAdvanced ? (
        <div className="grid gap-3">
          <input
            className="field-text"
            placeholder={t("wizard.basics.description")}
            value={w.description}
            onChange={(e) => w.set({ description: e.target.value })}
          />
          <input
            className="field-text"
            placeholder={t("wizard.basics.website")}
            value={w.website}
            onChange={(e) => w.set({ website: e.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}

export function StepTokenomics() {
  const { t } = useTranslation();
  const w = useWizard();
  return (
    <div className="grid gap-5">
      <div>
        <p className="mb-2 text-[12px] font-bold">{t("wizard.tokenomics.supplyMode")}</p>
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
        <p className="mb-2 text-[12px] font-bold">{t("wizard.tokenomics.ownership")}</p>
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
        <p className="mb-2 text-[12px] font-bold">{t("wizard.tokenomics.modules")}</p>
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
            <p className="mb-2 text-[12px] font-bold">{t("wizard.tokenomics.maxWallet")}</p>
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
            <p className="mb-2 text-[12px] font-bold">{t("wizard.tokenomics.taxBps")}</p>
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
      <p className="text-[13px] text-text-sub">{t("wizard.chains.hint")}</p>
      <div className="opt-grid">
        {featuredChains().map((c) => {
          const on = w.chains.includes(c.key);
          const live = c.enabled && c.evm;
          return (
            <OptionCard
              key={c.key}
              selected={on && live}
              disabled={!live}
              title={c.short === "NEAR" ? t("wizard.chains.near") : c.name}
              hint={
                !c.evm
                  ? t("wizard.chains.adaHint")
                  : `chainId ${c.chainId} · EID ${c.eid}${live ? "" : ` · ${t("wizard.chains.disabled")}`}`
              }
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
      <p className="text-[12px] font-bold text-text-muted">{t("wizard.chains.testnets")}</p>
      <div className="opt-grid">
        {testnetChains().map((c) => {
          const on = w.chains.includes(c.key);
          return (
            <OptionCard
              key={c.key}
              selected={on}
              title={c.name}
              hint={`chainId ${c.chainId} · EID ${c.eid}`}
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
  return (
    <div className="grid gap-5">
      <div>
        <p className="mb-2 text-[12px] font-bold">{t("wizard.liquidity.tokenBps")}</p>
        <ChipGroup
          ariaLabel="lp-bps"
          value={w.lpBps}
          onChange={(lpBps) => w.set({ lpBps })}
          options={LP_BPS.map((x) => ({ value: x.value, label: x.label }))}
        />
        <p className="mt-2 num text-[12px] text-text-muted">
          {lpAmt} / {w.totalSupply}
        </p>
      </div>
      <div>
        <p className="mb-2 text-[12px] font-bold">{t("wizard.liquidity.nativeAmount")}</p>
        <ChipGroup
          ariaLabel="lp-native"
          value={w.lpNativeAmount}
          onChange={(lpNativeAmount) => w.set({ lpNativeAmount })}
          options={NATIVE_PRESETS.map((v) => ({ value: v, label: `${v} ETH` }))}
        />
      </div>
      <div>
        <p className="mb-2 text-[12px] font-bold">{t("wizard.liquidity.mode")}</p>
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

export function StepOmnichain() {
  const { t } = useTranslation();
  const w = useWizard();
  return (
    <div className="space-y-3 text-[13px] leading-6 text-text-sub">
      <p>{t("wizard.omnichain.note")}</p>
      <p>{t("wizard.omnichain.addressNote")}</p>
      <div className="flex flex-wrap gap-2">
        {w.chains.map((k) => (
          <span key={k} className="chip chip-on">
            {CHAINS[k as keyof typeof CHAINS]?.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function StepReview() {
  const { t } = useTranslation();
  const w = useWizard();
  return (
    <div className="space-y-3">
      <div className="token-row">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-green text-xs font-black text-white">
          {(w.symbol || "??").slice(0, 2)}
        </div>
        <div>
          <p className="text-[13px] font-bold">
            {w.name || "—"} <span className="text-text-muted">{w.symbol}</span>
          </p>
          <p className="num text-[11px] text-text-muted">
            {w.totalSupply} · {w.decimals} dec · LP {w.lpBps / 100}% + {w.lpNativeAmount} ETH
          </p>
        </div>
        <Badge kind={w.supplyMode === SupplyMode.Fixed ? "ok" : "warn"}>
          {w.supplyMode === SupplyMode.Fixed ? "FIXED" : "MINT"}
        </Badge>
      </div>
      <ul className="space-y-1 text-[12px] text-text-sub">
        <li>{t("wizard.review.checklist")}</li>
        <li>{w.supplyMode === SupplyMode.Fixed ? t("wizard.review.fixed") : t("wizard.review.mintableWarn")}</li>
        <li>{t("wizard.review.lock")}</li>
        <li>{t("wizard.review.unaudited")}</li>
      </ul>
    </div>
  );
}

export const STEP_LABELS = [
  LaunchStep.Wallet,
  LaunchStep.Basics,
  LaunchStep.Tokenomics,
  LaunchStep.Chains,
  LaunchStep.Liquidity,
  LaunchStep.Omnichain,
  LaunchStep.Review,
  LaunchStep.Execute,
  LaunchStep.Success,
];
