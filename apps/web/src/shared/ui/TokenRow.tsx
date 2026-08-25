import type { ReactNode } from "react";

export function TokenRow({
  title,
  subtitle,
  badges,
  right,
  onClick,
}: {
  title: string;
  subtitle: string;
  badges?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-green text-xs font-black text-white">
        {title.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] font-bold">{title}</p>
          {badges}
        </div>
        <p className="num truncate text-[11px] text-text-muted">{subtitle}</p>
      </div>
      <div className="text-right">{right}</div>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="token-row w-full" onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div className="token-row">{inner}</div>;
}

export function Badge({ kind, children }: { kind: "warn" | "ok" | "info"; children: ReactNode }) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}

export function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="metric">
      <span className="metric-k">{k}</span>
      <span className="metric-v num">{v}</span>
    </div>
  );
}
