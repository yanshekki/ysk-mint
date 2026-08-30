type Opt<T extends string | number> = { value: T; label: string; disabled?: boolean; hint?: string };

export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Opt<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="me-chips">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          title={o.hint}
          className={`me-chip ${value === o.value ? "me-chip-on" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ChipMulti<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Opt<T>[];
  value: T[];
  onChange: (v: T[]) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="me-chips">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            role="checkbox"
            aria-checked={on}
            disabled={o.disabled}
            className={`me-chip ${on ? "me-chip-on" : ""}`}
            onClick={() => {
              if (o.disabled) return;
              onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value]);
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
