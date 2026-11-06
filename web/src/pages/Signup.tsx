import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Search } from 'lucide-react';
import type { GroupKey, RosterChoice } from '../../../shared/types';
import { useRosterOptions, useSignup } from '../lib/queries';
import { ApiClientError } from '../lib/api';
import { authError, safeNext } from '../lib/auth';
import { formatNumber } from '../lib/format';
import { Button, ChoiceRow, EmptyState, ListGroup, TextField } from '../components/ui';
import { PasswordField } from '../components/auth/PasswordField';
import { AuthFrame } from '../components/auth/AuthLayout';
import { FormErrors } from '../components/auth/FormErrors';
export default function Signup() {
  const mutation = useSignup();
  const roster = useRosterOptions();
  const navigate = useNavigate();
  const next = safeNext(useLocation().search);
  const [step, setStep] = useState(1);
  const [invite, setInvite] = useState(false);
  const [code, setCode] = useState('');
  const [options, setOptions] = useState<RosterChoice[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<RosterChoice>();
  const [group, setGroup] = useState<GroupKey>('normal');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const busy = mutation.isPending || roster.isPending;
  const total = selected && selected.role !== 'rower' ? 3 : 4;
  const position = step === 4 ? total : step;
  const title = invite
    ? 'Use Your Invite'
    : ['Join Stanford OYO', 'Find Your Name', 'Choose Your Group', 'Create Account'][step - 1];
  const subtitle = invite
    ? 'Sign up with the email on your team invitation'
    : [
        'Enter the code shared by your team',
        'Choose your own name from the team roster',
        'You can change your group later in Edit Profile',
        'Use your preferred email and a secure password',
      ][step - 1];
  useEffect(() => {
    const heading = document.querySelector<HTMLHeadingElement>('.auth-frame h1');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [step, invite]);
  function back() {
    setFields({});
    setMessage(undefined);
    if (invite) {
      setInvite(false);
      setStep(1);
    } else setStep(step === 4 && selected?.role !== 'rower' ? 2 : step - 1);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setFields({});
    setMessage(undefined);
    if (step === 1 && !invite) {
      if (!code.trim()) {
        setFields({ 'team-code': 'Enter your team join code' });
        return;
      }
      try {
        setOptions(await roster.mutateAsync({ body: { team_code: code.trim() } }));
        setSelected(undefined);
        setSearch('');
        setStep(2);
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 403)
          setFields({ 'team-code': 'That code is not correct. Ask your team for the join code' });
        else setMessage(authError(error));
      }
      return;
    }
    if (step === 2) {
      if (selected) setStep(selected.role === 'rower' ? 3 : 4);
      return;
    }
    if (step === 3) {
      setStep(4);
      return;
    }
    const errors: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errors.email = 'Enter a valid email address';
    if (password.length < 8) errors.password = 'Use at least 8 characters';
    if (Object.keys(errors).length) {
      setFields(errors);
      return;
    }
    try {
      await mutation.mutateAsync({
        body: {
          email: email.trim(),
          password,
          ...(!invite
            ? {
                team_code: code.trim(),
                roster_id: selected!.id,
                ...(selected!.role === 'rower' ? { group_key: group } : {}),
              }
            : {}),
        },
      });
      navigate(next, { replace: true });
    } catch (error) {
      if (error instanceof ApiClientError && error.detail.code === 'EMAIL_TAKEN')
        setFields({ email: 'This email is already registered. Log in instead' });
      else if (error instanceof ApiClientError && error.status === 409) {
        if (invite)
          setFields({
            email: 'This invitation is already claimed. Log in or ask a coxswain for help',
          });
        else {
          setMessage('That name was already claimed. Ask a coxswain to free it up.');
          setSelected(undefined);
          setSearch('');
          setStep(2);
          try {
            setOptions(await roster.mutateAsync({ body: { team_code: code.trim() } }));
          } catch {
            setOptions([]);
          }
        }
      } else if (error instanceof ApiClientError && error.status === 403) {
        if (invite)
          setFields({ email: 'Use the email on your team invitation, or join with a team code' });
        else {
          setStep(1);
          setFields({ 'team-code': 'That code is not correct. Ask your team for the join code' });
        }
      } else setMessage(authError(error));
    }
  }
  const filtered = options.filter((option) =>
    option.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <AuthFrame
      title={title}
      subtitle={subtitle}
      leading={
        (step > 1 || invite) && (
          <Button
            variant="plain"
            leading={<ChevronLeft size={20} strokeWidth={1.75} />}
            disabled={busy}
            onClick={back}
          >
            Back
          </Button>
        )
      }
    >
      {!invite && (
        <p className="mb-5 text-footnote text-muted tabular-nums">
          Step {formatNumber(position)} of {formatNumber(total)}
        </p>
      )}
      <form noValidate onSubmit={(event) => void submit(event)} className="space-y-5">
        <FormErrors message={message} fields={fields} />
        {step === 1 && !invite && (
          <TextField
            id="team-code"
            label="Team Join Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            error={fields['team-code']}
          />
        )}
        {step === 2 && (
          <>
            <TextField
              label="Search Names"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
            {filtered.length ? (
              <ListGroup>
                <fieldset aria-label="Your Name" disabled={busy}>
                  {filtered.map((option) => (
                    <ChoiceRow
                      key={option.id}
                      name="roster"
                      value={option.id}
                      checked={selected?.id === option.id}
                      onChange={() => setSelected(option)}
                      title={option.name}
                      subtitle={
                        option.role === 'rower'
                          ? undefined
                          : option.role === 'coxswain'
                            ? 'Coxswain'
                            : option.role === 'admin'
                              ? 'Admin'
                              : 'Coach'
                      }
                    />
                  ))}
                </fieldset>
              </ListGroup>
            ) : (
              <EmptyState
                icon={<Search size={28} strokeWidth={1.75} />}
                title={search ? 'No Matching Names' : 'No Unclaimed Names'}
                body="Try another search or ask a coxswain to check the roster"
              />
            )}
          </>
        )}
        {step === 3 && (
          <ListGroup>
            <fieldset aria-label="Your Group" disabled={busy}>
              {(
                [
                  ['frosh', 'Frosh'],
                  ['normal', 'Normal Non-Frosh'],
                  ['u23', 'U23-Senior Hopefuls'],
                ] as const
              ).map(([value, label]) => (
                <ChoiceRow
                  key={value}
                  name="group"
                  value={value}
                  checked={group === value}
                  onChange={() => setGroup(value)}
                  title={label}
                />
              ))}
            </fieldset>
          </ListGroup>
        )}
        {(step === 4 || invite) && (
          <>
            {!invite && <p className="text-subhead">{selected?.name}</p>}
            <TextField
              id="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              error={fields.email}
            />
            <PasswordField
              id="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              hint="Use at least 8 characters"
              error={fields.password}
            />
          </>
        )}
        <Button type="submit" fullWidth loading={busy} disabled={step === 2 && !selected}>
          {step === 4 || invite ? 'Create Account' : 'Continue'}
        </Button>
      </form>
      {step === 1 && !invite && (
        <div className="mt-3 text-center">
          <Button
            variant="plain"
            onClick={() => {
              setInvite(true);
              setFields({});
              setMessage(undefined);
            }}
          >
            Have an Invite Email?
          </Button>
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-1 text-subhead">
        <Link className="auth-text-link" to={`/login?next=${encodeURIComponent(next)}`}>
          Already Registered? Log In
        </Link>
      </div>
    </AuthFrame>
  );
}
