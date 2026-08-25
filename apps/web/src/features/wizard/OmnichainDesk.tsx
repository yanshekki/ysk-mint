import type { CSSProperties } from "react";
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

function meshLabel(c: ChainDefinition): string {
  return c.name.split(/\s+/)[0] || c.short;
}

function meshPoints(n: number): Array<{ x: number; y: number }> {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 50, y: 50 }];
  const start = n === 2 ? Math.PI : -Math.PI / 2;
  const radius = n === 2 ? 26 : n <= 4 ? 30 : 31;
  return Array.from({ length: n }, (_, i) => {
    const a = start + (i * 2 * Math.PI) / n;
    return { x: 50 + radius * Math.cos(a), y: 50 + radius * Math.sin(a) };
  });
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
  const pts = meshPoints(evm.length);
  const status =
    evm.length === 0
      ? t("wizard.omnichain.none")
      : evm.length === 1
        ? t("wizard.omnichain.single")
        : t("wizard.omnichain.peerCount", { n: evm.length, calls });

  return (
    <div className="oft-desk">
      <section className="oft-main">
        <header className="oft-head">
          <p className="wallet-kicker">{t("wizard.omnichain.kicker")}</p>
          <h2 className="oft-title">{t("wizard.omnichain.title")}</h2>
          <p className="oft-lede">{t("wizard.omnichain.lede")}</p>
          <p className="oft-metric">{status}</p>
        </header>

        <div className={`oft-mesh${evm.length <= 1 ? " oft-mesh-solo" : ""}`} aria-hidden={evm.length === 0}>
          <svg className="oft-mesh-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            {pts.map((from, i) =>
              pts.slice(i + 1).map((to, j) => (
                <line
                  key={`${i}-${i + 1 + j}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className="oft-mesh-line"
                />
              )),
            )}
          </svg>
          {evm.map((c, i) => {
            const p = pts[i];
            if (!p) return null;
            const style = {
              left: `${p.x}%`,
              top: `${p.y}%`,
            } as CSSProperties;
            return (
              <div key={c.key} className="oft-node" style={style} title={c.name}>
                <span className="oft-node-mark">
                  <img src={chainIcon(c)} alt="" width={28} height={28} />
                </span>
                <span className="oft-node-name">{meshLabel(c)}</span>
              </div>
            );
          })}
        </div>

        {evm.length ? (
          <ul className="oft-chain-list">
            {evm.map((c) => (
              <li key={c.key} className="oft-chain">
                <img src={chainIcon(c)} alt="" width={28} height={28} />
                <div>
                  <b>{c.name}</b>
                  <span className="num">{t("wizard.omnichain.eid", { eid: c.eid })}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <aside className="oft-side">
        <div className="oft-card">
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
        </div>

        {native.length ? (
          <div className="oft-card">
            <p className="wallet-kicker">{t("wizard.omnichain.native")}</p>
            <p className="oft-side-hint">{t("wizard.omnichain.nativeHint")}</p>
            <ul className="oft-chain-list">
              {native.map((c) => (
                <li key={c.key} className="oft-chain">
                  <img src={chainIcon(c)} alt="" width={28} height={28} />
                  <div>
                    <b>{c.name}</b>
                    <span>
                      {c.vm === "near"
                        ? t("wizard.chains.nearHint")
                        : c.vm === "cardano"
                          ? t("wizard.chains.adaHint")
                          : t("wizard.chains.solHint")}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="oft-card">
          <p className="wallet-kicker">{t("wizard.omnichain.run")}</p>
          <ol className="oft-run">
            {evm.length ? <li>{t("wizard.omnichain.runOft")}</li> : null}
            {calls ? <li>{t("wizard.omnichain.runPeer")}</li> : null}
            {native.length ? <li>{t("wizard.omnichain.runNative")}</li> : null}
          </ol>
        </div>
      </aside>
    </div>
  );
}
