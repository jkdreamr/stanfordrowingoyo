import { TextField, type TextFieldProps } from './TextField';
export function NumberField({
  inputMode = 'decimal',
  ...props
}: Omit<TextFieldProps, 'type' | 'inputMode'> & { inputMode?: 'numeric' | 'decimal' }) {
  return <TextField {...props} type="text" inputMode={inputMode} />;
}
