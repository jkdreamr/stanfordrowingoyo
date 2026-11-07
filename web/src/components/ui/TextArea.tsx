import type { TextareaHTMLAttributes } from 'react';
import { Field, type FieldProps } from './Field';
export function TextArea({
  label,
  hint,
  error,
  id,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field {...{ label, hint, error, id }}>
      {(a) => <textarea rows={4} {...props} {...a} className="ui-input" />}
    </Field>
  );
}
