import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { parseUnits } from "viem";
import { useAccount, useChainId } from "wagmi";
import { baseSepolia } from "wagmi/chains";
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
import { useWizard } from "./store.ts";
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
  const chainId = useChainId();
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
      if (!isConnected || chainId !== baseSepolia.id) {
        return [{ code: ErrorCode.ChainDisabled, args: [chainId], severity: "user", retryable: false }];
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
      return w.chains.flatMap((c) => validateChainEnabled(c, locale));
    }
    if (w.step === LaunchStep.Liquidity) {
      let tokenAmt = 0n;
      let nativeAmt = 0n;
      try {
        tokenAmt = parseUnits(w.lpTokenAmount || "0", w.decimals);
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
    <section className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">{t("wizard.title")}</h1>
      <ol className="mt-6 flex flex-wrap gap-2 text-xs">
        {STEP_LABELS.map((s) => (
          <li
            key={s}
            className={`rounded-full px-3 py-1 ${w.step === s ? "bg-brand-blue text-white" : "bg-white border border-border"}`}
          >
            {t(`wizard.steps.${s}`)}
          </li>
        ))}
      </ol>
      <div className="mt-8">{panel}</div>
      {errors.length ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">{t("wizard.errors")}</p>
          <ul className="mt-2 list-disc pl-5">
            {errors.map((e) => (
              <li key={e.code}>{e.message ?? e.code}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-6 flex gap-3">
        {w.step > LaunchStep.Wallet && w.step < LaunchStep.Success ? (
          <Button variant="ghost" type="button" onClick={() => w.set({ step: w.step - 1 })}>
            {t("wizard.back")}
          </Button>
        ) : null}
        {w.step < LaunchStep.Execute ? (
          <Button type="button" onClick={next} disabled={w.step === LaunchStep.Wallet && !address}>
            {t("wizard.next")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
