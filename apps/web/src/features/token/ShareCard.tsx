import { useRef } from "react";
import { Button } from "../../shared/ui/Button.tsx";
import { useTranslation } from "react-i18next";

export function ShareCard({ name, address }: { name: string; address: string }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLCanvasElement>(null);

  function draw() {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const g = ctx.createLinearGradient(0, 0, canvas.width, 0);
    g.addColorStop(0, "#3b82f6");
    g.addColorStop(1, "#10b981");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, 8);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 28px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(name || t("app.name"), 24, 64);
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(address, 24, 96);
    ctx.fillText(t("token.shareMark"), 24, 168);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ysk-mint-share.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="mt-4 space-y-2">
      <canvas ref={ref} width={640} height={200} className="hidden" />
      <Button type="button" variant="ghost" onClick={draw}>
        {t("token.share")}
      </Button>
      <p className="text-xs text-text-sub">{t("token.shareNote")}</p>
    </div>
  );
}
