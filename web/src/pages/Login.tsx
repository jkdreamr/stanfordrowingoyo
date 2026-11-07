import { useState, type FormEvent } from 'react';
import type { User } from '../../../shared/types';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLogin } from '../lib/queries';
import { authError, safeNext } from '../lib/auth';
import { Button, TextField } from '../components/ui';
import { PasswordField } from '../components/auth/PasswordField';
import { AuthFrame } from '../components/auth/AuthLayout';
import { FormErrors } from '../components/auth/FormErrors';
import { PasskeyIcon } from '../components/auth/PasskeyIcon';
import { biometricLabel } from '../lib/passkeys';
import { usePasskeySignIn } from '../lib/usePasskeyLogin';
export default function Login() {
  const mutation = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const next = safeNext(location.search);
  const [message, setMessage] = useState<string | undefined>(() =>
    typeof location.state?.passwordError === 'string' ? location.state.passwordError : undefined,
  );
  const [fields, setFields] = useState<Record<string, string>>({});
  const go = (user: User) =>
    navigate(
      user.must_change_password ? `/change-password?next=${encodeURIComponent(next)}` : next,
      { replace: true },
    );
  const label = biometricLabel();
  const passkey = usePasskeySignIn(go, (error) => {
    setFields({});
    setMessage(error);
  });
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mutation.isPending) return;
    const data = new FormData(e.currentTarget);
    const email = String(data.get('email')).trim();
    const password = String(data.get('password'));
    const errors: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address';
    if (!password) errors.password = 'Enter your password';
    setFields(errors);
    setMessage(undefined);
    if (Object.keys(errors).length) return;
    try {
      const user = await mutation.mutateAsync({ body: { email, password } });
      go(user);
    } catch (error) {
      setMessage(authError(error));
    }
  }
  return (
    <AuthFrame
      title="Stanford Rowing OYO"
      action={
        <Button
          type="submit"
          form="login-form"
          fullWidth
          loading={mutation.isPending}
          disabled={passkey.busy}
        >
          Log In
        </Button>
      }
    >
      <form id="login-form" className="space-y-5" noValidate onSubmit={(e) => void submit(e)}>
        <FormErrors message={message} fields={fields} />
        <TextField
          id="email"
          label="Email"
          name="email"
          type="email"
          autoComplete="username webauthn"
          autoCapitalize="none"
          spellCheck={false}
          required
          error={fields.email}
        />
        <PasswordField
          id="password"
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          error={fields.password}
        />
      </form>
      {passkey.supported && (
        <Button
          className="mt-5"
          variant="secondary"
          fullWidth
          leading={<PasskeyIcon label={label} />}
          loading={passkey.busy}
          disabled={mutation.isPending}
          onClick={() => {
            setMessage(undefined);
            void passkey.signIn();
          }}
        >
          {`Log In with ${label}`}
        </Button>
      )}
      <p className="mt-5 text-footnote text-muted">
        Ask a coxswain or coach to reset your password
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-1 text-subhead">
        <Link className="auth-text-link" to={`/signup?next=${encodeURIComponent(next)}`}>
          New to the Team? Sign Up
        </Link>
      </div>
    </AuthFrame>
  );
}
