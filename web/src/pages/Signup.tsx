import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSignup } from '../lib/queries';
import { ApiClientError } from '../lib/api';
import { authError, safeNext } from '../lib/auth';
import { Button, TextField } from '../components/ui';
import { PasswordField } from '../components/auth/PasswordField';
import { AuthFrame } from '../components/auth/AuthLayout';
import { FormErrors } from '../components/auth/FormErrors';
export default function Signup() {
  const mutation = useSignup();
  const navigate = useNavigate();
  const next = safeNext(useLocation().search);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mutation.isPending) return;
    const data = new FormData(e.currentTarget);
    const name = String(data.get('name')).trim();
    const email = String(data.get('email')).trim();
    const password = String(data.get('password'));
    const team_code = String(data.get('team_code')).trim();
    const errors: Record<string, string> = {};
    if (!name) errors.name = 'Enter your name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address';
    if (password.length < 8) errors.password = 'Use at least 8 characters';
    setFields(errors);
    setMessage(undefined);
    if (Object.keys(errors).length) return;
    try {
      await mutation.mutateAsync({
        body: { name, email, password, ...(team_code ? { team_code } : {}) },
      });
      navigate(next, { replace: true });
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        (error.status === 409 || error.detail.code === 'EMAIL_TAKEN')
      )
        setFields({ email: 'This email is already registered. Log in instead' });
      else if (
        error instanceof ApiClientError &&
        (['INVALID_TEAM_CODE', 'NOT_ON_ROSTER'].includes(error.detail.code) || error.status === 403)
      )
        setFields({
          'team-code': 'Enter a valid team code or ask staff to add your email to the roster',
        });
      else setMessage(authError(error));
    }
  }
  return (
    <AuthFrame title="Join Stanford OYO" subtitle="Keep your extra training with the team">
      <form noValidate onSubmit={(e) => void submit(e)} className="space-y-5">
        <FormErrors message={message} fields={fields} />
        <TextField
          id="name"
          label="Name"
          name="name"
          autoComplete="name"
          required
          error={fields.name}
        />
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
          autoComplete="new-password"
          minLength={8}
          required
          hint="Use at least 8 characters"
          error={fields.password}
        />
        <TextField
          id="team-code"
          label="Team Join Code"
          name="team_code"
          autoCapitalize="none"
          spellCheck={false}
          hint="Leave blank if your email is on the team roster"
          error={fields['team-code']}
        />
        <Button type="submit" fullWidth loading={mutation.isPending}>
          Sign Up
        </Button>
      </form>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-1 text-subhead">
        <span className="text-muted">Already Registered?</span>
        <Link className="auth-text-link" to={`/login?next=${encodeURIComponent(next)}`}>
          Log In
        </Link>
      </div>
    </AuthFrame>
  );
}
