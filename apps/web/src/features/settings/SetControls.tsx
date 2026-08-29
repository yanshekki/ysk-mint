import type { ReactNode } from "react";

export function SetSwitch({ on }: { on: boolean }) {
  return (
    <span className={`set-switch ${on ? "on" : ""}`} aria-hidden="true">
      <i />
    </span>
  );
}

export function SetItem({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="set-item">
      <div className="holding-meta">
        <b>{title}</b>
        <span>{hint}</span>
      </div>
      <div className="set-ctrl">{children}</div>
    </div>
  );
}

export function SetToggle({ title, hint, on, onChange }: { title: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className="set-item set-item-btn" aria-pressed={on} onClick={() => onChange(!on)}>
      <div className="holding-meta">
        <b>{title}</b>
        <span>{hint}</span>
      </div>
      <SetSwitch on={on} />
    </button>
  );
}
