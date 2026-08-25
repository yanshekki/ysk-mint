import type { ReactNode } from "react";

export function OptionCard({
  selected,
  disabled,
  title,
  hint,
  onSelect,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  hint?: string;
  onSelect: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      className={`opt-card ${selected ? "opt-card-on" : ""}`}
      onClick={onSelect}
    >
      <span className="opt-title">{title}</span>
      {hint ? <span className="opt-hint">{hint}</span> : null}
      {children}
    </button>
  );
}

export function OptionGrid({ children }: { children: ReactNode }) {
  return <div className="opt-grid">{children}</div>;
}
