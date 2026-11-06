import type { SelectHTMLAttributes } from 'react';
import { Field, type FieldProps } from './Field';
export function Select({
  label,
  hint,
  error,
  id,
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field {...{ label, hint, error, id }}>
      {(a) => (
        <select {...props} {...a} className="ui-input">
          {children}
        </select>
      )}
    </Field>
  );
}
