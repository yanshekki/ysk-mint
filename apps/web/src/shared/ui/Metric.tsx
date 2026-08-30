import type { ReactNode } from "react";

export function Metric({ label, className, children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <span className={["me-metric", className].filter(Boolean).join(" ")} {...(label ? { "data-label": label } : {})}>
      {children}
    </span>
  );
}
