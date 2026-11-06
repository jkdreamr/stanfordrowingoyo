import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLogin } from '../lib/queries';
import { authError, safeNext } from '../lib/auth';
import { Button, TextField } from '../components/ui';
import { PasswordField } from '../components/auth/PasswordField';
import { AuthFrame } from '../components/auth/AuthLayout';
import { FormErrors } from '../components/auth/FormErrors';
export default function Login() {
  const mutation = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const next = safeNext(location.search);
  const [message, setMessage] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
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
      navigate(
        user.must_change_password ? `/change-password?next=${encodeURIComponent(next)}` : next,
        { replace: true },
      );
    } catch (error) {
      setMessage(authError(error));
    }
  }
  return (
    <AuthFrame title="Stanford Rowing OYO" subtitle="Your extra training, counted">
      <form className="space-y-5" noValidate onSubmit={(e) => void submit(e)}>
        <FormErrors message={message} fields={fields} />
        <TextField
          id="email"
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
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
        <Button type="submit" fullWidth loading={mutation.isPending}>
          Log In
        </Button>
      </form>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-1 text-subhead">
        <span className="text-muted">New To The Team?</span>
        <Link className="auth-text-link" to={`/signup?next=${encodeURIComponent(next)}`}>
          Sign Up
        </Link>
      </div>
    </AuthFrame>
  );
}
