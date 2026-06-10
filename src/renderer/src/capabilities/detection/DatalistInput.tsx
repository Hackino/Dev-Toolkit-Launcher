import { useId } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

/**
 * A text input backed by a native datalist — the user can pick a detected value
 * from the dropdown or type a custom one. Used for application IDs, bundle IDs,
 * and gradle modules sourced from project introspection.
 */
export function DatalistInput({ value, onChange, options, placeholder, className }: Props) {
  const listId = useId();
  return (
    <>
      <input
        type="text"
        list={listId}
        className={className}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
