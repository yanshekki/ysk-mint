import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { enabledChains } from "@ysk-mint/config";
import { Button } from "../../shared/ui/Button.tsx";
import { Badge, Metric } from "../../shared/ui/TokenRow.tsx";

export function HomePage() {
  const { t } = useTranslation();
  const chains = enabledChains();

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-8">
      <div className="panel overflow-hidden">
        <div className="hairline" />
        <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge kind="ok">OFT</Badge>
              <Badge kind="info">LP LOCK</Badge>
              <Badge kind="warn">{t("nav.disclaimer")}</Badge>
            </div>
            <h1 className="text-3xl font-black tracking-tight md:text-[40px] md:leading-tight">{t("home.title")}</h1>
            <p className="mt-3 max-w-xl text-[14px] leading-6 text-text-sub">{t("home.body")}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/create">
                <Button variant="grad">{t("home.cta")}</Button>
              </Link>
              <Link to="/transfer">
                <Button variant="ghost">{t("nav.transfer")}</Button>
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-bg-subtle p-4">
            <Metric k="Nets" v={String(chains.length)} />
            <Metric k="OFT" v="LZ" />
            <Metric k="Fee" v="0" />
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {chains.map((c) => (
          <div key={c.chainId} className="token-row">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-white text-[10px] font-black text-brand-blue ring-1 ring-border">
              {c.nativeSymbol}
            </div>
            <div>
              <p className="text-[13px] font-bold">{c.name}</p>
              <p className="num text-[11px] text-text-muted">
                {c.chainId} · EID {c.eid}
              </p>
            </div>
            <Badge kind="ok">TESTNET</Badge>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12px] text-text-muted">{t("home.honesty")}</p>
    </section>
  );
}
