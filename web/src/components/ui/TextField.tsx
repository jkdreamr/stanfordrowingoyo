import type { InputHTMLAttributes, ReactNode } from 'react';
import { Field, type FieldProps } from './Field';
export type TextFieldProps = FieldProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & { suffix?: string; trailing?: ReactNode };
export function TextField({ label, hint, error, id, suffix, trailing, ...props }: TextFieldProps) {
  return (
    <Field {...{ label, hint, error, id }}>
      {(a) => (
        <div className="ui-input-wrap">
          <input {...props} {...a} />
          {trailing}
          {suffix && (
            <span className="text-muted" aria-hidden="true">
              {suffix}
            </span>
          )}
        </div>
      )}
    </Field>
  );
}
