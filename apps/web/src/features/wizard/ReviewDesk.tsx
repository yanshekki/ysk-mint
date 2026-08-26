import { useTranslation } from "react-i18next";
import { LockMode, OwnershipAction, SupplyMode } from "@ysk-mint/sdk";
import { type ChainDefinition } from "@ysk-mint/config";
import { useWizard } from "./store.ts";
import { Badge } from "../../shared/ui/TokenRow.tsx";
import { chainIcon } from "../../lib/chainIcon.ts";
import { homeEvm, ISSUANCE_GROUP_TITLE, issuanceGroups, undeployedEvm } from "../../lib/launchTargets.ts";
import { hasEvm, selectedVms } from "../../lib/wizardFlow.ts";

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="review-stat">
      <span className="review-k">{k}</span>
      <span className="review-v">{v}</span>
    </div>
  );
}

function ChainMark({ c }: { c: ChainDefinition }) {
  const { t } = useTranslation();
  const hint = c.evm
    ? t("wizard.omnichain.eid", { eid: c.eid })
    : c.testnet
      ? t("wizard.chains.testnets")
      : t("wizard.chains.mainnet");
  return (
    <article className="oft-chain">
      <img src={chainIcon(c)} alt="" width={32} height={32} />
      <div>
        <b>{c.name}</b>
        <span className="num">{hint}</span>
      </div>
    </article>
  );
}

function ownershipLabel(action: number, t: (k: string) => string) {
  if (action === OwnershipAction.Renounce) return t("wizard.tokenomics.renounce");
  if (action === OwnershipAction.TransferSafe) return t("wizard.tokenomics.safe");
  if (action === OwnershipAction.TransferTimelock) return t("wizard.tokenomics.timelock");
  return t("wizard.tokenomics.keep");
}

function lockLabel(mode: number, duration: number, t: (k: string) => string) {
  if (mode === LockMode.Burn) return t("wizard.liquidity.burn");
  if (duration === 90 * 86400) return t("wizard.liquidity.d90");
  if (duration === 180 * 86400) return t("wizard.liquidity.d180");
  if (duration === 365 * 86400) return t("wizard.liquidity.d365");
  return t("wizard.liquidity.d30");
}

export function StepReview() {
  const { t } = useTranslation();
  const w = useWizard();
  const evm = hasEvm(w.chains);
  const vms = selectedVms(w.chains);
  const home = homeEvm(w.chains);
  const nat = home?.nativeSymbol ?? "";
  const missing = undeployedEvm(w.chains);
  const selected = new Set(w.chains);
  const groups = issuanceGroups()
    .map((g) => ({
      vm: g.vm,
      main: g.main.filter((c) => selected.has(c.key)),
      test: g.test.filter((c) => selected.has(c.key)),
    }))
    .filter((g) => g.main.length || g.test.length);

  const notes: string[] = [t("wizard.review.unaudited")];
  if (missing.length) notes.push(t("wizard.basics.gapUndeployedEvm", { names: missing.map((c) => c.short).join("、") }));
  if (vms.includes("near")) notes.push(t("wizard.basics.gapNearFactory"));
  if (vms.includes("cardano")) notes.push(t("wizard.basics.gapAdaFactory"));
  if (vms.includes("solana")) notes.push(t("wizard.basics.gapSolProgram"));
  if (vms.includes("sui")) notes.push(t("wizard.basics.gapSuiFactory"));
  if (vms.includes("aptos")) notes.push(t("wizard.basics.gapAptosFactory"));
  if (!evm) notes.push(t("wizard.review.nativeNoLp"));

  const on = t("wizard.review.on");
  const off = t("wizard.review.off");

  return (
    <div className="review-desk">
      <div className="token-row review-id">
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
          {w.supplyMode === SupplyMode.Fixed ? t("wizard.review.fixed") : t("wizard.review.mintable")}
        </Badge>
      </div>

      <section className="chain-group">
        <p className="chain-group-title">{t("wizard.review.token")}</p>
        <div className="chain-row">
          <Stat k={t("wizard.basics.name")} v={w.name || "—"} />
          <Stat k={t("wizard.basics.symbol")} v={w.symbol || "—"} />
          <Stat k={t("wizard.basics.decimals")} v={String(w.decimals)} />
          <Stat k={t("wizard.basics.supply")} v={w.totalSupply} />
          <Stat
            k={t("wizard.tokenomics.supplyMode")}
            v={w.supplyMode === SupplyMode.Fixed ? t("wizard.review.fixed") : t("wizard.review.mintable")}
          />
        </div>
      </section>

      {evm ? (
        <section className="chain-group">
          <p className="chain-group-title">{t("wizard.review.rules")}</p>
          <div className="chain-row">
            <Stat k={t("wizard.tokenomics.ownership")} v={ownershipLabel(w.ownershipAction, t)} />
            <Stat k={t("wizard.tokenomics.pause")} v={w.modulePause ? on : off} />
            <Stat k={t("wizard.tokenomics.tax")} v={w.moduleTax ? `${w.taxBps / 100}%` : off} />
            <Stat k={t("wizard.tokenomics.maxTx")} v={w.moduleMaxTx ? `${w.maxWalletBps / 100}%` : off} />
          </div>
        </section>
      ) : null}

      {evm ? (
        <section className="chain-group">
          <p className="chain-group-title">{t("wizard.review.lp")}</p>
          <div className="chain-row">
            <Stat k={t("wizard.liquidity.tokenBps")} v={`${w.lpBps / 100}%`} />
            <Stat k={t("wizard.liquidity.nativeAmount")} v={`${w.lpNativeAmount} ${nat}`} />
            <Stat k={t("wizard.liquidity.mode")} v={lockLabel(w.lockMode, w.lockDuration, t)} />
          </div>
        </section>
      ) : null}

      <section className="chain-group">
        <p className="chain-group-title">{t("wizard.review.issuance")}</p>
        {groups.map((g) => (
          <div key={g.vm} className="review-issuance">
            <p className="chain-sub">{t(ISSUANCE_GROUP_TITLE[g.vm] ?? "wizard.chains.groupEvm")}</p>
            {g.vm === "evm" ? (
              <>
                {g.main.length ? (
                  <div className="chain-row">
                    {g.main.map((c) => (
                      <ChainMark key={c.key} c={c} />
                    ))}
                  </div>
                ) : null}
                {g.test.length ? (
                  <>
                    {g.main.length ? <p className="chain-sub">{t("wizard.chains.testnets")}</p> : null}
                    <div className="chain-row">
                      {g.test.map((c) => (
                        <ChainMark key={c.key} c={c} />
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <div className="chain-row">
                {g.main.map((c) => (
                  <ChainMark key={c.key} c={c} />
                ))}
                {g.test.map((c) => (
                  <ChainMark key={c.key} c={c} />
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="chain-group">
        <p className="chain-group-title">{t("wizard.review.notes")}</p>
        <ul className="review-notes">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
