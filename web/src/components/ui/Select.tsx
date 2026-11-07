import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
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
        <div className="relative">
          <select {...props} {...a} className="ui-input appearance-none pr-10">
            {children}
          </select>
          <ChevronDown
            aria-hidden="true"
            size={18}
            strokeWidth={1.75}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
          />
        </div>
      )}
    </Field>
  );
}
