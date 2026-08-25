export function StepRail({
  steps,
  current,
  onJump,
}: {
  steps: { id: number; label: string }[];
  current: number;
  onJump?: (id: number) => void;
}) {
  return (
    <nav className="step-rail" aria-label="wizard">
      {steps.map((s) => {
        const done = s.id < current;
        const on = s.id === current;
        return (
          <button
            key={s.id}
            type="button"
            className={`step-item ${on ? "step-item-on" : ""} ${done ? "step-item-done" : ""}`}
            onClick={() => onJump?.(s.id)}
          >
            <span className="step-dot">{done ? "✓" : s.id + 1}</span>
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}
