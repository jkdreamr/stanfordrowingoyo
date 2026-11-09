import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { qk, useChangePassword, useVerifyPassword } from '../../lib/queries';
import { ApiClientError } from '../../lib/api';
import { authError, loginNoticeKey } from '../../lib/auth';
import { Button } from '../ui';
import { PasswordField } from './PasswordField';
import { FormErrors } from './FormErrors';
export function ChangePasswordForm({
  onSuccess,
  forced = false,
}: {
  onSuccess: () => void;
  forced?: boolean;
}) {
  const mutation = useChangePassword();
  const verify = useVerifyPassword();
  const navigate = useNavigate();
  const client = useQueryClient();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [needsCurrent, setNeedsCurrent] = useState(!forced);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const current = String(data.get('current'));
    const password = String(data.get('password'));
    const confirm = String(data.get('confirm'));
    const errors: Record<string, string> = {};
    if (needsCurrent && !current) errors['current-password'] = 'Enter your current password';
    else if (needsCurrent && (current.length < 8 || current.length > 200))
      errors['current-password'] = 'Use between 8 and 200 characters';
    if (password.length < 8) errors['new-password'] = 'Use at least 8 characters';
    if (password.length > 200) errors['new-password'] = 'Use at most 200 characters';
    if (confirm !== password) errors['confirm-password'] = 'Passwords do not match';
    setFields(errors);
    setMessage(undefined);
    if (Object.keys(errors).length) return;
    inFlight.current = true;
    setBusy(true);
    let stage: 'verify' | 'change' = needsCurrent ? 'verify' : 'change';
    try {
      const grant = needsCurrent
        ? await verify.mutateAsync({ body: { current_password: current } })
        : undefined;
      stage = 'change';
      await mutation.mutateAsync({
        body: { new_password: password, ...(grant ? { reauth_token: grant.reauth_token } : {}) },
      });
      form.reset();
      onSuccess();
    } catch (error) {
      if (error instanceof ApiClientError) {
        const code = error.detail.code;
        if (error.status === 401 && code === 'INVALID_CREDENTIALS') {
          setFields({ 'current-password': 'Current password is incorrect.' });
          return;
        }
        if (error.status === 401 && code === 'REAUTH_REQUIRED') {
          setNeedsCurrent(true);
          setFields({
            'current-password': 'For your security, enter your current password again.',
          });
          const input = form.elements.namedItem('current') as HTMLInputElement | null;
          if (input) input.value = '';
          return;
        }
        if (
          (error.status === 401 && code === 'UNAUTHENTICATED') ||
          (error.status === 409 && code === 'CREDENTIALS_CHANGED')
        ) {
          const passwordError =
            code === 'CREDENTIALS_CHANGED'
              ? `${error.detail.message} Log in again to continue.`
              : 'Please log in to change your password.';
          client.clear();
          client.setQueryData(loginNoticeKey, passwordError);
          client.setQueryData(qk.me(), null);
          navigate('/login', { replace: true, state: { passwordError } });
          return;
        }
        if (error.status === 400 && code === 'VALIDATION_ERROR') {
          setFields({
            [stage === 'verify' ? 'current-password' : 'new-password']: error.detail.message,
          });
          return;
        }
      }
      setMessage(authError(error));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="space-y-5">
      <FormErrors message={message} fields={fields} />
      {needsCurrent && (
        <PasswordField
          id="current-password"
          label="Current Password"
          name="current"
          autoComplete="current-password"
          required
          disabled={busy}
          maxLength={200}
          error={fields['current-password']}
        />
      )}
      <PasswordField
        id="new-password"
        label="New Password"
        name="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={200}
        disabled={busy}
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
        maxLength={200}
        disabled={busy}
        error={fields['confirm-password']}
      />
      <Button type="submit" fullWidth loading={busy}>
        Change Password
      </Button>
    </form>
  );
}
