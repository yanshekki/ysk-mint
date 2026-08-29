import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { clampMaxOutbound, clampMaxOutboundPerHost } from "../../lib/outbound.ts";
import { useUserSettings } from "../../lib/userSettings.ts";

export function OutboundFields() {
  const { t } = useTranslation();
  const total = useUserSettings((s) => s.maxOutbound);
  const perHost = useUserSettings((s) => s.maxOutboundPerHost);
  const patch = useUserSettings((s) => s.patch);
  const [totalText, setTotalText] = useState(String(total));
  const [hostText, setHostText] = useState(String(perHost));

  useEffect(() => {
    setTotalText(String(total));
    setHostText(String(perHost));
  }, [total, perHost]);

  function commitTotal(raw = totalText) {
    const g = clampMaxOutbound(raw);
    const h = clampMaxOutboundPerHost(useUserSettings.getState().maxOutboundPerHost, g);
    patch({ maxOutbound: g, maxOutboundPerHost: h });
    setTotalText(String(g));
    setHostText(String(h));
  }

  function commitHost(raw = hostText) {
    const g = clampMaxOutbound(useUserSettings.getState().maxOutbound);
    const h = clampMaxOutboundPerHost(raw, g);
    patch({ maxOutboundPerHost: h });
    setHostText(String(h));
  }

  return (
    <div className="set-outbound">
      <label>
        {t("settings.outboundTotal")}
        <input
          className="field-text set-outbound-input"
          inputMode="numeric"
          min={1}
          max={32}
          value={totalText}
          aria-label={t("settings.outboundTotal")}
          onChange={(e) => {
            const raw = e.target.value;
            setTotalText(raw);
            if (/^\d+$/.test(raw.trim()) && String(clampMaxOutbound(raw)) === raw.trim()) commitTotal(raw);
          }}
          onBlur={() => {
            if (String(clampMaxOutbound(totalText)) !== totalText.trim()) commitTotal();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </label>
      <label>
        {t("settings.outboundHost")}
        <input
          className="field-text set-outbound-input"
          inputMode="numeric"
          min={1}
          max={32}
          value={hostText}
          aria-label={t("settings.outboundHost")}
          onChange={(e) => {
            const raw = e.target.value;
            setHostText(raw);
            if (/^\d+$/.test(raw.trim()) && String(clampMaxOutboundPerHost(raw, total)) === raw.trim()) commitHost(raw);
          }}
          onBlur={() => {
            const g = clampMaxOutbound(useUserSettings.getState().maxOutbound);
            if (String(clampMaxOutboundPerHost(hostText, g)) !== hostText.trim()) commitHost();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </label>
    </div>
  );
}
