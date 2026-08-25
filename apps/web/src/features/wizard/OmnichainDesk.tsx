import { useTranslation } from "react-i18next";
import { type ChainDefinition } from "@ysk-mint/config";
import { useWizard } from "./store.ts";
import { chainIcon } from "../../lib/chainIcon.ts";
import { ISSUANCE_GROUP_TITLE, issuanceGroups } from "../../lib/launchTargets.ts";

export function StepOmnichain() {
  const { t } = useTranslation();
  const w = useWizard();
  const selected = new Set(w.chains);
  const groups = issuanceGroups()
    .map((g) => ({
      vm: g.vm,
      main: g.main.filter((c) => selected.has(c.key)),
      test: g.test.filter((c) => selected.has(c.key)),
    }))
    .filter((g) => g.main.length || g.test.length);
  const evm = groups.find((g) => g.vm === "evm");
  const evmCount = (evm?.main.length ?? 0) + (evm?.test.length ?? 0);
  const nativeCount = groups.filter((g) => g.vm !== "evm").reduce((n, g) => n + g.main.length + g.test.length, 0);
  const calls = evmCount > 1 ? evmCount * (evmCount - 1) : 0;
  const status =
    evmCount === 0
      ? t("wizard.omnichain.none")
      : evmCount === 1
        ? t("wizard.omnichain.single")
        : t("wizard.omnichain.peerCount", { n: evmCount, calls });

  return (
    <div className="oft-desk">
      <header className="oft-head">
        <p className="wallet-kicker">{t("wizard.omnichain.kicker")}</p>
        <h2 className="oft-title">{t("wizard.omnichain.title")}</h2>
        <p className="oft-lede">{t("wizard.omnichain.lede")}</p>
        <p className="oft-metric">{status}</p>
      </header>

      {groups.map((g) => (
        <section key={g.vm} className="chain-group">
          <p className="chain-group-title">{t(ISSUANCE_GROUP_TITLE[g.vm])}</p>
          {g.vm === "evm" ? (
            <>
              {g.main.length ? (
                <div className="chain-row">
                  {g.main.map((c) => (
                    <PeerCard key={c.key} c={c} />
                  ))}
                </div>
              ) : null}
              {g.test.length ? (
                <>
                  <p className="chain-sub">{t("wizard.chains.testnets")}</p>
                  <div className="chain-row">
                    {g.test.map((c) => (
                      <PeerCard key={c.key} c={c} />
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div className="chain-row">
              {g.main.map((c) => (
                <PeerCard key={c.key} c={c} />
              ))}
              {g.test.map((c) => (
                <PeerCard key={c.key} c={c} />
              ))}
            </div>
          )}
        </section>
      ))}

      <div className="oft-meta">
        <section className="oft-card">
          <p className="wallet-kicker">{t("wizard.omnichain.facts")}</p>
          <ul className="oft-facts">
            <li>
              <b>{t("wizard.omnichain.factRate")}</b>
              <span>{t("wizard.omnichain.factRateHint")}</span>
            </li>
            {calls ? (
              <li>
                <b>{t("wizard.omnichain.factPeer")}</b>
                <span>{t("wizard.omnichain.factPeerHint")}</span>
              </li>
            ) : null}
            <li>
              <b>{t("wizard.omnichain.factAddr")}</b>
              <span>{t("wizard.omnichain.factAddrHint")}</span>
            </li>
          </ul>
        </section>
        <section className="oft-card">
          <p className="wallet-kicker">{t("wizard.omnichain.run")}</p>
          <ol className="oft-run">
            {evmCount ? <li>{t("wizard.omnichain.runOft")}</li> : null}
            {calls ? <li>{t("wizard.omnichain.runPeer")}</li> : null}
            {nativeCount ? <li>{t("wizard.omnichain.runNative")}</li> : null}
          </ol>
        </section>
      </div>
    </div>
  );
}

function PeerCard({ c }: { c: ChainDefinition }) {
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
