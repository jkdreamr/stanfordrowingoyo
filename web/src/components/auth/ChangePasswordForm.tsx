import { useState, type FormEvent } from 'react';
import { useChangePassword } from '../../lib/queries';
import { authError } from '../../lib/auth';
import { Button } from '../ui';
import { PasswordField } from './PasswordField';
import { FormErrors } from './FormErrors';
export function ChangePasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const mutation = useChangePassword();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mutation.isPending) return;
    const data = new FormData(e.currentTarget);
    const current = String(data.get('current'));
    const password = String(data.get('password'));
    const confirm = String(data.get('confirm'));
    const errors: Record<string, string> = {};
    if (!current) errors['current-password'] = 'Enter your current password';
    if (password.length < 8) errors['new-password'] = 'Use at least 8 characters';
    if (confirm !== password) errors['confirm-password'] = 'Passwords do not match';
    setFields(errors);
    setMessage(undefined);
    if (Object.keys(errors).length) return;
    try {
      await mutation.mutateAsync({ body: { current_password: current, new_password: password } });
      onSuccess();
    } catch (error) {
      setMessage(authError(error));
    }
  }
  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="space-y-5">
      <FormErrors message={message} fields={fields} />
      <PasswordField
        id="current-password"
        label="Current Password"
        name="current"
        autoComplete="current-password"
        required
        error={fields['current-password']}
      />
      <PasswordField
        id="new-password"
        label="New Password"
        name="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint="Use at least 8 characters"
        error={fields['new-password']}
      />
      <PasswordField
        id="confirm-password"
        label="Confirm Password"
        name="confirm"
        autoComplete="new-password"
        required
        error={fields['confirm-password']}
      />
      <Button type="submit" fullWidth loading={mutation.isPending}>
        Change Password
      </Button>
    </form>
  );
}
