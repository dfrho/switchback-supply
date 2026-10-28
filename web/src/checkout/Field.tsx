import type { InputHTMLAttributes } from 'react';
import type { FieldName } from './form';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'value' | 'onChange'> {
  name: FieldName;
  label: string;
  value: string;
  error?: string;
  onValue: (name: FieldName, value: string) => void;
}

/** A labeled checkout input with an accessible inline error message. */
export default function Field({ name, label, value, error, onValue, ...inputProps }: Props) {
  const id = `checkout-${name}`;
  const errorId = `${id}-error`;
  return (
    <label htmlFor={id} className={error ? 'has-error' : undefined}>
      {label}
      <input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onValue(name, e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <span id={errorId} className="field-error">
          {error}
        </span>
      )}
    </label>
  );
}
