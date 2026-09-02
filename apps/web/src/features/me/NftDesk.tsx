import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { chainIcon } from "../../lib/chainIcon.ts";
import { CHAINS } from "@ysk-mint/config";
import { nftIndexed, type NftSet, type NftStd } from "../../lib/nfts.ts";

const OPEN_MAX = 1;
const PREVIEW_N = 4;

function chainIco(chainId: number) {
  const c = Object.values(CHAINS).find((x) => x.chainId === chainId);
  return c ? chainIcon(c) : "/tokens/eth.png";
}

function initials(name: string) {
  const s = name.replace(/[^A-Za-z0-9\u4e00-\u9fff\u3400-\u4dbf]/g, " ").trim();
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "N";
  const b = parts.length > 1 ? parts[1]![0] : parts[0]?.[1] || "";
  return (a + b).toUpperCase();
}

function hue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function Art({ src, label, decorative }: { src?: string; label: string; decorative?: boolean }) {
  const [bad, setBad] = useState(!src);
  useEffect(() => {
    setBad(!src);
  }, [src]);
  if (bad || !src) {
    const h = hue(label);
    return (
      <span
        className="me-nft-ph"
        style={{ background: `hsl(${h} 32% 90%)`, color: `hsl(${h} 28% 28%)` }}
        aria-hidden={decorative || undefined}
      >
        {initials(label)}
      </span>
    );
  }
  return (
    <img src={src} alt={decorative ? "" : label} loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} />
  );
}

export function NftDesk({
  sets,
  loading,
  failed,
  chainFilter,
}: {
  sets: NftSet[];
  loading: boolean;
  failed: boolean;
  chainFilter: number | "all";
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [std, setStd] = useState<NftStd | "all">("all");
  const [hasArt, setHasArt] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [manual, setManual] = useState(false);

  const scoped = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return sets.filter((s) => {
      if (chainFilter !== "all" && s.chainId !== chainFilter) return false;
      if (std !== "all" && s.std !== std) return false;
      const pieces = hasArt ? s.pieces.filter((p) => p.image) : s.pieces;
      if (hasArt && !s.icon && !pieces.length) return false;
      if (!qq) return true;
      if (s.name.toLowerCase().includes(qq) || s.symbol.toLowerCase().includes(qq) || s.contract.includes(qq)) return true;
      return s.pieces.some((p) => p.name.toLowerCase().includes(qq) || p.tokenId.toLowerCase().includes(qq) || `#${p.tokenId}`.includes(qq));
    });
  }, [sets, chainFilter, std, hasArt, q]);

  useEffect(() => {
    if (manual) return;
    if (!scoped.length) return;
    setOpen(new Set(scoped.slice(0, Math.min(OPEN_MAX, scoped.length)).map((s) => s.id)));
  }, [scoped, manual]);

  useEffect(() => {
    setManual(false);
  }, [chainFilter, std, q, hasArt]);

  const pieces = scoped.reduce((n, s) => n + s.amount, 0);
  const noIndex = chainFilter !== "all" && !nftIndexed(chainFilter);
  const allOpen = scoped.length > 0 && scoped.every((s) => open.has(s.id));

  function toggle(id: string) {
    setManual(true);
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAll(on: boolean) {
    setManual(true);
    setOpen(on ? new Set(scoped.map((s) => s.id)) : new Set());
  }

  return (
    <section className="me-card me-nft-desk">
      <div className="me-card-head">
        <div>
          <p className="me-proto-kicker">{t("me.nftKicker")}</p>
          <b>{t("me.nftTitle")}</b>
        </div>
        <span className="me-count">{loading && !sets.length ? "…" : t("me.nftSets", { n: scoped.length, p: pieces })}</span>
      </div>
      <p className="me-tx-hint">{t("me.nftHint")}</p>
      <div className="me-tx-tools me-nft-tools">
        <input
          className="me-filter"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("me.nftSearch")}
          aria-label={t("me.nftSearch")}
        />
        <div className="me-chips">
          <button type="button" className={`me-chip ${std === "all" ? "me-chip-on" : ""}`} onClick={() => setStd("all")}>
            {t("me.all")}
          </button>
          <button type="button" className={`me-chip ${std === "ERC-721" ? "me-chip-on" : ""}`} onClick={() => setStd("ERC-721")}>
            {t("me.nft721")}
          </button>
          <button type="button" className={`me-chip ${std === "ERC-1155" ? "me-chip-on" : ""}`} onClick={() => setStd("ERC-1155")}>
            {t("me.nft1155")}
          </button>
          <label className="me-hide-zero">
            <input type="checkbox" checked={hasArt} onChange={(e) => setHasArt(e.target.checked)} />
            {t("me.nftHasArt")}
          </label>
          {scoped.length > 1 ? (
            <button type="button" className="me-nft-fold" onClick={() => setAll(!allOpen)}>
              {allOpen ? t("me.nftCollapse") : t("me.nftExpand")}
            </button>
          ) : null}
        </div>
      </div>
      {noIndex ? (
        <p className="me-card-empty">{t("me.nftNoIndex")}</p>
      ) : loading && !sets.length ? (
        <p className="me-card-empty">{t("me.nftLoading")}</p>
      ) : failed && !scoped.length ? (
        <p className="me-card-empty">{t("me.nftFail")}</p>
      ) : !scoped.length ? (
        <p className="me-card-empty">{t("me.nftEmpty")}</p>
      ) : (
        <div className="me-nft-sets">
          {scoped.map((s) => {
            const shown = hasArt ? s.pieces.filter((p) => p.image) : s.pieces;
            const on = open.has(s.id);
            const previews = (hasArt ? shown : [...s.pieces].sort((a, b) => Number(!!b.image) - Number(!!a.image))).slice(0, PREVIEW_N);
            return (
              <article key={s.id} className={`me-nft-set${on ? " is-open" : ""}`}>
                <button type="button" className="me-nft-set-head" onClick={() => toggle(s.id)} aria-expanded={on}>
                  <span className="me-nft-set-ico">
                    <Art src={s.icon} label={s.name} decorative />
                    <img className="me-nft-chain" src={chainIco(s.chainId)} alt="" width={16} height={16} />
                  </span>
                  <span className="me-nft-set-meta">
                    <span className="me-nft-set-title">
                      <b>{s.name}</b>
                      <span className="me-nft-set-n">{t("me.nftPieces", { n: s.amount })}</span>
                    </span>
                    <span>
                      {s.chain}
                      {" · "}
                      {s.std === "ERC-1155" ? t("me.nft1155") : t("me.nft721")}
                      {s.symbol ? ` · ${s.symbol}` : ""}
                    </span>
                    {!on && previews.length ? (
                      <span className="me-nft-previews" aria-hidden>
                        {previews.map((p) => (
                          <span key={p.id} className="me-nft-preview">
                            <Art src={p.image} label={p.name} decorative />
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                  <span className="me-nft-caret" aria-hidden>
                    {on ? "▾" : "▸"}
                  </span>
                </button>
                {on ? (
                  <div className="me-nft-body">
                    {shown.length ? (
                      <div className="me-nft-grid">
                        {shown.map((p) => (
                          <a key={p.id} className="me-nft-tile" href={p.href} target="_blank" rel="noreferrer">
                            <span className="me-nft-art">
                              <Art src={p.image} label={p.name} />
                            </span>
                            <b>{p.name}</b>
                            <span>
                              #{p.tokenId.length > 10 ? `${p.tokenId.slice(0, 6)}…` : p.tokenId}
                              {p.qty > 1 ? ` · ×${p.qty}` : ""}
                            </span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="me-nft-none">{t("me.nftNoArt")}</p>
                    )}
                    <div className="me-nft-foot">
                      <a className="me-pool-btn me-pool-btn-explore" href={s.href} target="_blank" rel="noreferrer">
                        {t("me.nftOpen")}
                      </a>
                      {s.rest > 0 ? <span className="me-tx-hint">{t("me.nftRest", { n: s.rest })}</span> : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
