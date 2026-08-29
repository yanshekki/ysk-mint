import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import { CHAINS } from "@ysk-mint/config";
import {
  ErrorCode,
  LaunchStep,
  type LaunchError,
  validateBasics,
  validateChainEnabled,
  validateLock,
  validateLpAmounts,
  validateName,
  validateSymbol,
  validateSupply,
} from "@ysk-mint/sdk";
import { Button } from "../../shared/ui/Button.tsx";
import { useWizard } from "./store.ts";
import { sdkLocale } from "../../lib/locale.ts";
import { useNativeWallets } from "../../lib/nativeWallets.ts";
import { lpTokenAmount } from "./presets.ts";
import { STEP_FLOW, flowIndex, hasEvm, nextFlowStep, prevFlowStep } from "../../lib/wizardFlow.ts";
import {
  StepBasics,
  StepChains,
  StepLiquidity,
  StepOmnichain,
  StepReview,
  StepTokenomics,
  StepWallet,
} from "./steps.tsx";
import { StepExecute } from "./StepExecute.tsx";
import { StepSuccess } from "./StepSuccess.tsx";

export function CreatePage() {
  const { t, i18n } = useTranslation();
  const locale = sdkLocale(i18n.language);
  const w = useWizard();
  const { address, isConnected } = useAccount();
  const native = useNativeWallets();
  const [errors, setErrors] = useState<LaunchError[]>([]);

  const panel = useMemo(() => {
    switch (w.step) {
      case LaunchStep.Wallet:
        return <StepWallet />;
      case LaunchStep.Basics:
        return <StepBasics />;
      case LaunchStep.Tokenomics:
        return <StepTokenomics />;
      case LaunchStep.Chains:
        return <StepChains />;
      case LaunchStep.Liquidity:
        return <StepLiquidity />;
      case LaunchStep.Omnichain:
        return <StepOmnichain />;
      case LaunchStep.Review:
        return <StepReview />;
      case LaunchStep.Execute:
        return <StepExecute />;
      default:
        return <StepSuccess />;
    }
  }, [w.step]);

  function validateCurrent(): LaunchError[] {
    if (w.step === LaunchStep.Wallet) {
      if (!isConnected && !native.nearAccount && !native.cardanoAddress && !native.solanaAddress) {
        return [{ code: ErrorCode.RecipientZero, args: [], severity: "user", retryable: false }];
      }
      return [];
    }
    if (w.step === LaunchStep.Basics) {
      let supply = 0n;
      try {
        supply = parseUnits(w.totalSupply || "0", w.decimals);
      } catch {
        supply = 0n;
      }
      if (hasEvm(w.chains)) {
        return validateBasics({ name: w.name, symbol: w.symbol, decimals: w.decimals, totalSupply: supply }, locale);
      }
      return [...validateName(w.name, locale), ...validateSymbol(w.symbol, locale), ...validateSupply(supply, locale)];
    }
    if (w.step === LaunchStep.Chains) {
      if (!w.chains.length) {
        return [{ code: ErrorCode.InvalidChainKey, args: [0], severity: "user", retryable: false, message: t("wizard.chains.needOne") }];
      }
      const list = w.chains.flatMap((c) => validateChainEnabled(c, locale));
      const needsEvm = w.chains.some((c) => CHAINS[c as keyof typeof CHAINS]?.evm);
      if (needsEvm && !isConnected) {
        list.push({ code: ErrorCode.RecipientZero, args: [], severity: "user", retryable: false });
      }
      const picked = w.chains.map((k) => CHAINS[k as keyof typeof CHAINS]);
      if (picked.some((c) => c?.vm === "near") && !native.nearAccount) {
        list.push({ code: ErrorCode.RecipientZero, args: [], severity: "user", retryable: false });
      }
      if (picked.some((c) => c?.vm === "cardano") && !native.cardanoAddress) {
        list.push({ code: ErrorCode.RecipientZero, args: [], severity: "user", retryable: false });
      }
      if (picked.some((c) => c?.vm === "solana") && !native.solanaAddress) {
        list.push({ code: ErrorCode.RecipientZero, args: [], severity: "user", retryable: false });
      }
      return list;
    }
    if (w.step === LaunchStep.Liquidity) {
      if (!hasEvm(w.chains)) return [];
      let tokenAmt = 0n;
      let nativeAmt = 0n;
      try {
        tokenAmt = parseUnits(lpTokenAmount(w.totalSupply, w.lpBps), w.decimals);
        nativeAmt = parseUnits(w.lpNativeAmount || "0", 18);
      } catch {
        tokenAmt = 0n;
      }
      return [...validateLpAmounts(tokenAmt, nativeAmt, locale), ...validateLock(w.lockMode, w.lockDuration, locale)];
    }
    return [];
  }

  function next() {
    const list = validateCurrent();
    setErrors(list);
    if (list.length) return;
    if (w.step !== LaunchStep.Success) w.set({ step: nextFlowStep(w.step) });
  }

  const idx = flowIndex(w.step);

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">{t("wizard.kicker")}</p>
          <h1>{t("nav.create")}</h1>
          <p className="mt-1 text-[15px] text-text-sub">{t("wizard.hint")}</p>
        </div>
      </div>
      <div className="workspace-scroll">
        <div className="me-desk">
          <div className="me-chips" role="tablist" aria-label="wizard">
            {STEP_FLOW.filter((id) => id !== LaunchStep.Success).map((id) => {
              const i = flowIndex(id);
              const on = i === idx;
              const done = i < idx;
              return (
                <button
                  key={id}
                  type="button"
                  className={`me-chip ${on ? "me-chip-on" : ""}`}
                  disabled={i > idx}
                  onClick={() => {
                    if (i <= idx) w.set({ step: id });
                  }}
                >
                  {done ? "✓ " : ""}
                  {t(`wizard.steps.${id}`)}
                </button>
              );
            })}
          </div>
          {w.step === LaunchStep.Wallet ? (
            panel
          ) : w.step === LaunchStep.Success ? (
            <section className="me-card">{panel}</section>
          ) : (
            <section className="me-card">
              <div className="me-card-body">{panel}</div>
            </section>
          )}
          {errors.length ? (
            <div className="me-errors">
              <b>{t("wizard.errors")}</b>
              <ul>
                {errors.map((e) => (
                  <li key={e.code}>{e.message ?? e.code}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
      {w.step < LaunchStep.Success ? (
        <div className="workspace-actions">
          {w.step === LaunchStep.Wallet ? (
            <div className="wallet-action-status">
              <span className={isConnected ? "on" : ""}>EVM</span>
              <span className={native.nearAccount ? "on" : ""}>NEAR</span>
              <span className={native.cardanoAddress ? "on" : ""}>ADA</span>
              <span className={native.solanaAddress ? "on" : ""}>SOL</span>
            </div>
          ) : null}
          {w.step !== LaunchStep.Wallet ? (
            <Button variant="ghost" type="button" onClick={() => w.set({ step: prevFlowStep(w.step) })}>
              {t("wizard.back")}
            </Button>
          ) : null}
          {w.step < LaunchStep.Execute ? (
            <Button
              variant="grad"
              type="button"
              onClick={next}
              disabled={w.step === LaunchStep.Wallet && !address && !native.nearAccount && !native.cardanoAddress && !native.solanaAddress}
            >
              {t("wizard.next")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
