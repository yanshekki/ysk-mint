import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { KIND_ICON, confirmKind, detectAddrKind, shortAddr, type AddrKind } from "../../lib/addrKind.ts";
import { type AddrErr, type SavedAddr } from "../../lib/addressSets.ts";
import { domainNames, useDomainName, type DomainHit } from "../../lib/domainNames/index.ts";

export function AddrAddBar({
  onAdd,
  disabled,
}: {
  onAdd: (kind: AddrKind, value: string) => AddrErr | null;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [raw, setRaw] = useState("");
  const [picked, setPicked] = useState<AddrKind | null>(null);
  const [err, setErr] = useState<AddrErr | "invalid" | null>(null);
  const [nameHit, setNameHit] = useState<DomainHit | null>(null);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameBad, setNameBad] = useState(false);

  const isName = domainNames.looksLikeName(raw);
  const hit = useMemo(() => (isName ? null : detectAddrKind(raw)), [isName, raw]);

  useEffect(() => {
    if (!isName) {
      setNameHit(null);
      setNameBusy(false);
      setNameBad(false);
      return;
    }
    const q = raw.trim();
    setNameBusy(true);
    setNameBad(false);
    setNameHit(null);
    const tmr = window.setTimeout(() => {
      void domainNames
        .resolve(q)
        .then((found) => {
          setNameHit(found);
          setNameBad(!found);
        })
        .catch(() => {
          setNameHit(null);
          setNameBad(true);
        })
        .finally(() => setNameBusy(false));
    }, 300);
    return () => window.clearTimeout(tmr);
  }, [isName, raw]);

  const kind =
    nameHit?.kind ??
    (picked && hit?.ok && (hit.kind === picked || hit.candidates?.includes(picked)) ? picked : hit?.ok ? hit.kind : undefined);

  function submit(nextKind?: AddrKind) {
    if (nameHit) {
      const fail = onAdd(nameHit.kind, nameHit.address);
      if (fail) {
        setErr(fail);
        return;
      }
      setRaw("");
      setPicked(null);
      setErr(null);
      setNameHit(null);
      return;
    }
    const k = nextKind ?? kind;
    if (!k || !hit?.ok) {
      setErr("invalid");
      return;
    }
    const confirmed = confirmKind(raw, k);
    if (!confirmed.ok || !confirmed.kind) {
      setErr("invalid");
      return;
    }
    const fail = onAdd(confirmed.kind, confirmed.value);
    if (fail) {
      setErr(fail);
      return;
    }
    setRaw("");
    setPicked(null);
    setErr(null);
  }

  const preview = !raw.trim()
    ? null
    : isName
      ? nameBusy
        ? t("settings.addrNameWait")
        : nameHit
          ? t("settings.addrNameHit", {
              service: t(`settings.ns.${nameHit.service}`, { defaultValue: nameHit.service }),
              kind: t(`settings.kind.${nameHit.kind}`),
              addr: shortAddr(nameHit.kind, nameHit.address),
            })
          : t("settings.addrNameBad")
      : hit?.ok && hit.kind
        ? t("settings.addrHit", { kind: t(`settings.kind.${hit.kind}`), addr: shortAddr(hit.kind, hit.value) })
        : hit?.ok && hit.candidates
          ? t("settings.addrPick")
          : t("settings.addrBad");

  const bad = Boolean(err) || nameBad || (!isName && hit && !hit.ok && raw.trim().length > 0);

  return (
    <div className="addr-add">
      <div className="addr-add-row">
        <input
          className="me-filter addr-input"
          value={raw}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t("settings.addrPaste")}
          aria-label={t("settings.addrPaste")}
          onChange={(e) => {
            setRaw(e.target.value);
            setPicked(null);
            setErr(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          className="me-pool-btn me-pool-btn-dex"
          disabled={disabled || nameBusy || !(nameHit || kind)}
          onClick={() => submit()}
        >
          {t("settings.addrAdd")}
        </button>
      </div>
      {!isName && hit?.ok && hit.candidates ? (
        <div className="me-chips">
          {hit.candidates.map((k) => (
            <button
              key={k}
              type="button"
              className={`me-chip ${picked === k ? "me-chip-on" : ""}`}
              onClick={() => {
                setPicked(k);
                submit(k);
              }}
            >
              <img src={KIND_ICON[k]} alt="" width={20} height={20} />
              {t(`settings.kind.${k}`)}
            </button>
          ))}
        </div>
      ) : null}
      {preview ? <p className={`addr-preview ${bad ? "is-bad" : ""}`}>{err ? t(`settings.addrErr.${err}`) : preview}</p> : null}
    </div>
  );
}

export function AddrIdCard({
  kind,
  value,
  connected,
}: {
  kind: AddrKind;
  value: string;
  connected?: boolean;
}) {
  const { t } = useTranslation();
  const name = useDomainName(kind, value);
  return (
    <div className="me-id">
      <img src={KIND_ICON[kind]} alt="" width={28} height={28} />
      <div>
        <b>{name || t(`settings.kind.${kind}`)}</b>
        <span className="num">{shortAddr(kind, value)}</span>
      </div>
      {connected ? <span className="addr-pill">{t("me.connected")}</span> : null}
    </div>
  );
}

export function AddrRow({
  addr,
  connected,
  onRemove,
}: {
  addr: SavedAddr;
  connected?: boolean;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const name = useDomainName(addr.kind, addr.value);
  return (
    <div className="me-token">
      <span className="holding-ico-wrap">
        <img src={KIND_ICON[addr.kind]} alt="" className="holding-ico" />
      </span>
      <div className="holding-meta">
        <b>{name || t(`settings.kind.${addr.kind}`)}</b>
        <span className="num">{shortAddr(addr.kind, addr.value)}</span>
      </div>
      {connected ? <span className="addr-pill">{t("settings.addrConnected")}</span> : null}
      {onRemove ? (
        <button type="button" className="me-pool-btn me-pool-btn-explore" onClick={onRemove}>
          {t("settings.addrRemove")}
        </button>
      ) : null}
    </div>
  );
}
