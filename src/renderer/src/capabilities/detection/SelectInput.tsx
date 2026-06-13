interface Props {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * A detection-only dropdown: the user can only *select* a value, never type one.
 * Options come from project introspection. The currently-saved value is always
 * present as an option (even if detection hasn't surfaced it yet) so editing an
 * existing project never silently drops its value.
 */
export function SelectInput({ value, onChange, options, placeholder, className, disabled }: Props) {
  const merged = value && !options.includes(value) ? [value, ...options] : options;
  const empty = merged.length === 0;

  return (
    <select
      className={className}
      value={value}
      disabled={disabled || empty}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled>
        {empty ? (placeholder ? `${placeholder} — run Detect` : 'Run Detect to populate') : (placeholder ?? 'Select…')}
      </option>
      {merged.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
