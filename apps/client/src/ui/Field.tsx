import type { InputHTMLAttributes } from 'react';

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'aria-invalid' | 'aria-describedby'> {
  id: string;
  label: string;
  /** The rule, shown under the field before the player types. */
  hint?: string;
  /** What is wrong with the text now, in plain words; replaces nothing, it is shown beside the hint. */
  error?: string | null;
}

/** A labelled text field in style A with its rule always shown and its problem named, both read out with the field. */
export function Field({ id, label, hint, error, ...input }: FieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint === undefined ? null : hintId, error ? errorId : null].filter((part) => part !== null).join(' ');
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy === '' ? undefined : describedBy} {...input} />
      {hint !== undefined && (
        <p className="form-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error ? (
        <p className="form-field-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
