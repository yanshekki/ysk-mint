import { CHAINS, ChainKey, LaunchStep, LockMode, OwnershipAction, SupplyMode, LOCK_MIN_SECONDS } from "@ysk-mint/sdk";
import { useAccount } from "wagmi";
import { useTranslation } from "react-i18next";
import { useWizard } from "./store.ts";

const field = "mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm";
const labelCls = "block text-sm font-medium text-text-main";

export function StepWallet() {
  const { t } = useTranslation();
  const { isConnected, address } = useAccount();
  return (
    <div className="space-y-3">
      <p className="text-text-sub">{t("wizard.wallet.need")}</p>
      <p className="font-mono text-sm break-all">{isConnected ? address : "—"}</p>
    </div>
  );
}

export function StepBasics() {
  const { t } = useTranslation();
  const w = useWizard();
  return (
    <div className="grid gap-4">
      <label className={labelCls}>
        {t("wizard.basics.name")}
        <input className={field} value={w.name} onChange={(e) => w.set({ name: e.target.value })} />
      </label>
      <label className={labelCls}>
        {t("wizard.basics.symbol")}
        <input className={field} value={w.symbol} onChange={(e) => w.set({ symbol: e.target.value.toUpperCase() })} />
      </label>
      <label className={labelCls}>
        {t("wizard.basics.decimals")}
        <input
          className={field}
          type="number"
          min={6}
          max={18}
          value={w.decimals}
          onChange={(e) => w.set({ decimals: Number(e.target.value) })}
        />
      </label>
      <label className={labelCls}>
        {t("wizard.basics.supply")}
        <input className={field} value={w.totalSupply} onChange={(e) => w.set({ totalSupply: e.target.value })} />
      </label>
      <label className={labelCls}>
        {t("wizard.basics.description")}
        <textarea className={field} value={w.description} onChange={(e) => w.set({ description: e.target.value })} />
      </label>
      <label className={labelCls}>
        {t("wizard.basics.logo")}
        <input className={field} value={w.logoUri} onChange={(e) => w.set({ logoUri: e.target.value })} />
      </label>
      <label className={labelCls}>
        {t("wizard.basics.website")}
        <input className={field} value={w.website} onChange={(e) => w.set({ website: e.target.value })} />
      </label>
    </div>
  );
}

export function StepTokenomics() {
  const { t } = useTranslation();
  const w = useWizard();
  return (
    <div className="grid gap-4">
      <fieldset>
        <legend className={labelCls}>{t("wizard.tokenomics.supplyMode")}</legend>
        <label className="mt-2 flex gap-2 text-sm">
          <input
            type="radio"
            checked={w.supplyMode === SupplyMode.Fixed}
            onChange={() => w.set({ supplyMode: SupplyMode.Fixed })}
          />
          {t("wizard.tokenomics.fixed")}
        </label>
        <label className="mt-2 flex gap-2 text-sm">
          <input
            type="radio"
            checked={w.supplyMode === SupplyMode.Mintable}
            onChange={() => w.set({ supplyMode: SupplyMode.Mintable })}
          />
          {t("wizard.tokenomics.mintable")}
        </label>
      </fieldset>
      <fieldset>
        <legend className={labelCls}>{t("wizard.tokenomics.ownership")}</legend>
        {(
          [
            [OwnershipAction.Keep, "keep"],
            [OwnershipAction.Renounce, "renounce"],
            [OwnershipAction.TransferSafe, "safe"],
            [OwnershipAction.TransferTimelock, "timelock"],
          ] as const
        ).map(([v, key]) => (
          <label key={v} className="mt-2 flex gap-2 text-sm">
            <input
              type="radio"
              checked={w.ownershipAction === v}
              onChange={() => w.set({ ownershipAction: v })}
            />
            {t(`wizard.tokenomics.${key}`)}
          </label>
        ))}
        {w.ownershipAction === OwnershipAction.TransferSafe ||
        w.ownershipAction === OwnershipAction.TransferTimelock ? (
          <input
            className={field}
            placeholder="0x…"
            value={w.ownershipTarget}
            onChange={(e) => w.set({ ownershipTarget: e.target.value })}
          />
        ) : null}
      </fieldset>
    </div>
  );
}

export function StepChains() {
  const { t } = useTranslation();
  const w = useWizard();
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-sub">{t("wizard.chains.hint")}</p>
      {Object.values(CHAINS).map((c) => {
        const enabled = c.key === ChainKey.BaseSepolia;
        const checked = w.chains.includes(c.key);
        return (
          <label key={c.chainId} className="flex items-center justify-between rounded-xl border border-border bg-white p-3">
            <span>
              {c.name}
              {!enabled ? <span className="ml-2 text-xs text-text-sub">{t("wizard.chains.disabled")}</span> : null}
            </span>
            <input
              type="checkbox"
              checked={checked && enabled}
              disabled={!enabled}
              onChange={(e) => w.set({ chains: e.target.checked ? [c.key] : [] })}
            />
          </label>
        );
      })}
    </div>
  );
}

export function StepLiquidity() {
  const { t } = useTranslation();
  const w = useWizard();
  const days = [30, 90, 180, 365];
  return (
    <div className="grid gap-4">
      <label className={labelCls}>
        {t("wizard.liquidity.tokenAmount")}
        <input className={field} value={w.lpTokenAmount} onChange={(e) => w.set({ lpTokenAmount: e.target.value })} />
      </label>
      <label className={labelCls}>
        {t("wizard.liquidity.nativeAmount")}
        <input className={field} value={w.lpNativeAmount} onChange={(e) => w.set({ lpNativeAmount: e.target.value })} />
      </label>
      <fieldset>
        <legend className={labelCls}>{t("wizard.liquidity.mode")}</legend>
        <label className="mt-2 flex gap-2 text-sm">
          <input type="radio" checked={w.lockMode === LockMode.Timed} onChange={() => w.set({ lockMode: LockMode.Timed })} />
          {t("wizard.liquidity.timed")}
        </label>
        <label className="mt-2 flex gap-2 text-sm">
          <input type="radio" checked={w.lockMode === LockMode.Burn} onChange={() => w.set({ lockMode: LockMode.Burn })} />
          {t("wizard.liquidity.burn")}
        </label>
      </fieldset>
      {w.lockMode === LockMode.Timed ? (
        <label className={labelCls}>
          {t("wizard.liquidity.duration")}
          <select
            className={field}
            value={w.lockDuration}
            onChange={(e) => w.set({ lockDuration: Number(e.target.value) })}
          >
            {days.map((d) => (
              <option key={d} value={d * LOCK_MIN_SECONDS / 30}>
                {d} days
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

export function StepOmnichain() {
  const { t } = useTranslation();
  return <p className="text-sm leading-6 text-text-sub">{t("wizard.omnichain.note")}</p>;
}

export function StepReview() {
  const { t } = useTranslation();
  const w = useWizard();
  return (
    <div className="space-y-4">
      <dl className="space-y-2 rounded-2xl border border-border bg-white p-4 text-sm">
        <div className="flex justify-between gap-4"><dt>Name</dt><dd>{w.name} ({w.symbol})</dd></div>
        <div className="flex justify-between gap-4"><dt>Supply</dt><dd>{w.totalSupply}</dd></div>
        <div className="flex justify-between gap-4"><dt>LP</dt><dd>{w.lpTokenAmount} + {w.lpNativeAmount} ETH</dd></div>
      </dl>
      <ul className="list-disc space-y-1 pl-5 text-sm text-text-sub">
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
