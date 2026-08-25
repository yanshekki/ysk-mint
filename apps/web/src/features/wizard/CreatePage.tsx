import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { LaunchStep } from "@ysk-mint/sdk";

export function CreatePage() {
  const { t } = useTranslation();
  const { address, isConnected } = useAccount();

  return (
    <section className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">{t("create.title")}</h1>
      <p className="mt-3 text-text-sub">{t("create.phase")}</p>
      <dl className="mt-8 space-y-3 rounded-2xl border border-border bg-white p-5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-text-sub">LaunchStep</dt>
          <dd className="font-mono">{LaunchStep.Wallet}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text-sub">Wallet</dt>
          <dd className="break-all font-mono">{isConnected ? address : "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
