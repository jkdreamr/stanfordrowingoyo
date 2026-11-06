import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { IconButton, TextField } from '../ui';
import type { TextFieldProps } from '../ui/TextField';
export function PasswordField(props: Omit<TextFieldProps, 'type' | 'trailing'>) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <IconButton
          className="-my-3 -mr-3"
          aria-label={`${visible ? 'Hide' : 'Show'} ${props.label}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
        </IconButton>
      }
    />
  );
}
