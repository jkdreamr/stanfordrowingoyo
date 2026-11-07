import { useId, type ReactNode } from 'react';
export type FieldProps = { label: string; hint?: string; error?: string; id?: string };
export function Field({
  label,
  hint,
  error,
  id: supplied,
  children,
}: FieldProps & {
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: true;
  }) => ReactNode;
}) {
  const generated = useId();
  const id = supplied || generated;
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        'aria-describedby': hint || error ? `${id}-help` : undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {(hint || error) && (
        <div
          id={`${id}-help`}
          className={`text-footnote ${error ? 'text-accent-ink' : 'text-muted'}`}
        >
          {hint && <p>{hint}</p>}
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
