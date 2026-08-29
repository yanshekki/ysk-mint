import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { KIND_ICON, detectAddrKind, shortAddr, type AddrKind } from "../../lib/addrKind.ts";
import { MAX_ADDRS } from "../../lib/addressSets.ts";
import { domainNames } from "../../lib/domainNames/index.ts";
import type { SharePayload } from "../../lib/shareSet.ts";

type Pending = { kind: AddrKind; value: string; label?: string };

function chunksOf(raw: string) {
  return raw
    .split(/[\s,;|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function parseOne(raw: string): Promise<Pending | null> {
  const s = raw.trim();
  if (!s) return null;
  const hit = detectAddrKind(s);
  if (hit.ok && hit.kind) return { kind: hit.kind, value: hit.value };
  if (domainNames.looksLikeName(s)) {
    const name = await domainNames.resolve(s).catch(() => null);
    if (!name) return null;
    return { kind: name.kind, value: name.address, label: name.name };
  }
  return null;
}

export function PeekDialog({
  open,
  onClose,
  onView,
}: {
  open: boolean;
  onClose: () => void;
  onView: (payload: SharePayload) => void;
}) {
  const { t } = useTranslation();
  const [raw, setRaw] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) {
      setRaw("");
      setPending([]);
      setBusy(false);
      setNote("");
    }
  }, [open]);

  async function absorb(text: string) {
    const parts = chunksOf(text);
    if (!parts.length) return;
    setBusy(true);
    const hits: Pending[] = [];
    let bad = 0;
    for (const part of parts) {
      const hit = await parseOne(part);
      if (!hit) {
        bad += 1;
        continue;
      }
      hits.push(hit);
    }
    let size = 0;
    setPending((cur) => {
      const next = [...cur];
      const seen = new Set(next.map((a) => `${a.kind}:${a.value.toLowerCase()}`));
      for (const hit of hits) {
        if (next.length >= MAX_ADDRS) break;
        const k = `${hit.kind}:${hit.value.toLowerCase()}`;
        if (seen.has(k)) continue;
        seen.add(k);
        next.push(hit);
      }
      size = next.length;
      return next;
    });
    setRaw("");
    setBusy(false);
    if (parts.length && !hits.length && bad) setNote(t("settings.addrBad"));
    else if (size >= MAX_ADDRS) setNote(t("settings.addrErr.full"));
    else setNote("");
  }

  function view() {
    if (!pending.length) return;
    const names = [...new Set(pending.map((a) => a.label).filter(Boolean))] as string[];
    onView({
      name: (names.join(" · ") || t("me.peek")).slice(0, 40),
      addrs: pending.map((a) => ({ kind: a.kind, value: a.value })),
    });
  }

  if (!open) return null;
  return (
    <div className="me-peek-back" role="presentation" onClick={onClose}>
      <div
        className="me-peek"
        role="dialog"
        aria-modal="true"
        aria-labelledby="me-peek-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="me-peek-title" className="session-pop-title">
          {t("me.peekTitle")}
        </p>
        <p className="me-peek-hint">{t("me.peekHint")}</p>
        <textarea
          className="me-filter addr-input me-peek-ta"
          autoFocus
          rows={3}
          disabled={busy || pending.length >= MAX_ADDRS}
          value={raw}
          placeholder={t("me.peekPaste")}
          onChange={(e) => setRaw(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (chunksOf(text).length > 1) {
              e.preventDefault();
              void absorb(`${raw} ${text}`);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (raw.trim()) void absorb(raw);
              else view();
            }
          }}
        />
        <div className="addr-add-row">
          <button
            type="button"
            className="me-pool-btn me-pool-btn-explore"
            disabled={busy || !raw.trim() || pending.length >= MAX_ADDRS}
            onClick={() => void absorb(raw)}
          >
            {t("me.peekAdd")}
          </button>
          <button type="button" className="me-pool-btn me-pool-btn-dex" disabled={busy || !pending.length} onClick={view}>
            {t("me.peekGo")}
          </button>
        </div>
        {pending.length ? (
          <div className="me-peek-chips">
            {pending.map((a, i) => (
              <button
                key={`${a.kind}:${a.value}`}
                type="button"
                className="me-chip"
                onClick={() => setPending(pending.filter((_, j) => j !== i))}
              >
                <img src={KIND_ICON[a.kind]} alt="" width={20} height={20} />
                {a.label || shortAddr(a.kind, a.value)}
                <span className="me-count">×</span>
              </button>
            ))}
          </div>
        ) : null}
        {note ? <p className="addr-preview is-bad">{note}</p> : null}
        {busy ? <p className="addr-preview">{t("settings.addrNameWait")}</p> : null}
      </div>
    </div>
  );
}
