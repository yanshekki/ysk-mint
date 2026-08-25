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
} from "@ysk-mint/sdk";
import { Button } from "../../shared/ui/Button.tsx";
import { StepRail } from "../../shared/ui/StepRail.tsx";
import { useWizard } from "./store.ts";
import { useNativeWallets } from "../../lib/nativeWallets.ts";
import { lpTokenAmount } from "./presets.ts";
import {
  STEP_LABELS,
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
  const locale = i18n.language === "zh-HK" ? "zh-HK" : "en";
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
      if (!isConnected && !native.nearAccount && !native.cardanoAddress) {
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
      return validateBasics({ name: w.name, symbol: w.symbol, decimals: w.decimals, totalSupply: supply }, locale);
    }
    if (w.step === LaunchStep.Chains) {
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
      return list;
    }
    if (w.step === LaunchStep.Liquidity) {
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
    if (w.step < LaunchStep.Success) w.set({ step: w.step + 1 });
  }

  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-text-muted">Launch</p>
          <h1>{t("wizard.title")}</h1>
        </div>
        <span className="badge badge-warn">{t("nav.disclaimer")}</span>
      </div>
      <div className="workspace-body">
        <aside className="workspace-rail">
          <StepRail
            current={w.step}
            onJump={(id) => {
              if (id <= w.step) w.set({ step: id });
            }}
            steps={STEP_LABELS.map((id) => ({ id, label: t(`wizard.steps.${id}`) }))}
          />
        </aside>
        <div className="workspace-main">
          <div className="workspace-scroll">{panel}</div>
          {errors.length ? (
            <div className="mx-8 mb-0 rounded-xl border border-red-200 bg-red-50 p-3 text-[15px] text-red-800">
              <p className="font-bold">{t("wizard.errors")}</p>
              <ul className="mt-1 space-y-1">
                {errors.map((e) => (
                  <li key={e.code}>{e.message ?? e.code}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {w.step < LaunchStep.Success ? (
            <div className="workspace-actions">
              {w.step === LaunchStep.Wallet ? (
                <div className="wallet-action-status">
                  <span className={isConnected ? "on" : ""}>EVM</span>
                  <span className={native.nearAccount ? "on" : ""}>NEAR</span>
                  <span className={native.cardanoAddress ? "on" : ""}>ADA</span>
                </div>
              ) : null}
              {w.step > LaunchStep.Wallet ? (
                <Button variant="ghost" type="button" onClick={() => w.set({ step: w.step - 1 })}>
                  {t("wizard.back")}
                </Button>
              ) : null}
              {w.step < LaunchStep.Execute ? (
                <Button
                  variant="grad"
                  type="button"
                  onClick={next}
                  disabled={w.step === LaunchStep.Wallet && !address && !native.nearAccount && !native.cardanoAddress}
                >
                  {t("wizard.next")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
