import { useTranslation } from "react-i18next";
import { CHAINS, type ChainDefinition } from "@ysk-mint/config";
import { useWizard } from "./store.ts";

function chainIcon(c: ChainDefinition): string {
  if (c.vm === "near") return "/tokens/near.png";
  if (c.vm === "cardano") return "/tokens/ada.png";
  if (c.vm === "solana") return "/tokens/sol.png";
  if (c.nativeSymbol === "BNB") return "/tokens/bnb.png";
  if (c.nativeSymbol === "AVAX") return "/tokens/avax.png";
  if (c.chainId === 42161 || c.chainId === 421614) return "/tokens/arb.png";
  return "/tokens/eth.png";
}

function nativeHintKey(c: ChainDefinition) {
  if (c.vm === "near") return "wizard.chains.nearHint";
  if (c.vm === "cardano") return "wizard.chains.adaHint";
  return "wizard.chains.solHint";
}

export function StepOmnichain() {
  const { t } = useTranslation();
  const w = useWizard();
  const picked = w.chains
    .map((k) => CHAINS[k as keyof typeof CHAINS])
    .filter((c): c is ChainDefinition => Boolean(c));
  const evm = picked.filter((c) => c.evm && c.eid > 0);
  const native = picked.filter((c) => !c.evm);
  const calls = evm.length > 1 ? evm.length * (evm.length - 1) : 0;
  const status =
    evm.length === 0
      ? t("wizard.omnichain.none")
      : evm.length === 1
        ? t("wizard.omnichain.single")
        : t("wizard.omnichain.peerCount", { n: evm.length, calls });

  return (
    <div className="oft-desk">
      <header className="oft-head">
        <p className="wallet-kicker">{t("wizard.omnichain.kicker")}</p>
        <h2 className="oft-title">{t("wizard.omnichain.title")}</h2>
        <p className="oft-lede">{t("wizard.omnichain.lede")}</p>
        <p className="oft-metric">{status}</p>
      </header>

      <div className={`oft-body${evm.length ? "" : " oft-body-solo"}`}>
        {evm.length ? (
          <ul className="oft-chain-list oft-evm-grid">
            {evm.map((c) => (
              <li key={c.key} className="oft-chain">
                <img src={chainIcon(c)} alt="" width={32} height={32} />
                <div>
                  <b>{c.name}</b>
                  <span className="num">{t("wizard.omnichain.eid", { eid: c.eid })}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="oft-meta">
          {native.length ? (
            <section className="oft-card">
              <p className="wallet-kicker">{t("wizard.omnichain.native")}</p>
              <p className="oft-side-hint">{t("wizard.omnichain.nativeHint")}</p>
              <ul className="oft-chain-list">
                {native.map((c) => (
                  <li key={c.key} className="oft-chain">
                    <img src={chainIcon(c)} alt="" width={32} height={32} />
                    <div>
                      <b>{c.name}</b>
                      <span>{t(nativeHintKey(c))}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

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
              {evm.length ? <li>{t("wizard.omnichain.runOft")}</li> : null}
              {calls ? <li>{t("wizard.omnichain.runPeer")}</li> : null}
              {native.length ? <li>{t("wizard.omnichain.runNative")}</li> : null}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
