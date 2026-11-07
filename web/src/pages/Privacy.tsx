import { Link } from 'react-router-dom';
import { useMe } from '../lib/queries';
import { AuthFrame } from '../components/auth/AuthLayout';
import { Button } from '../components/ui';

const sections = [
  [
    'Your Team',
    'Signed-in teammates and staff see your profile, workouts, photos, tags, comments, kudos and totals. No private workouts.',
  ],
  [
    'Staff',
    'Coxswains, coaches and admins also see account emails and compliance. Only admins can permanently remove rower accounts.',
  ],
  [
    'Only You',
    'My Fortnight plans are owner-only. Staff cannot view them. Passwords and login sessions are never shared.',
  ],
  [
    'Photos',
    'Photos live in the team’s Cloudflare database. Current avatars and workout photos are team-visible. Unattached uploads are owner-only; unreferenced photos are deleted when detached.',
  ],
  [
    'Your Data',
    'Download your data in Settings. Ask an admin for permanent removal: account, workouts, photos, comments, kudos, private plans, tags, mentions and rankings. A sanitized audit record remains. Others’ saved copies, free-text references and backups may remain.',
  ],
] as const;

export default function Privacy() {
  const { data: me } = useMe();
  return (
    <AuthFrame
      title="Privacy"
      leading={
        <Button to={me ? '/settings' : '/signup'} variant="plain">
          Back
        </Button>
      }
    >
      <div className="space-y-6">
        {sections.map(([title, body]) => (
          <section key={title}>
            <h2 className="text-headline">{title}</h2>
            <p className="mt-2 text-subhead text-muted">{body}</p>
          </section>
        ))}
        <Link className="auth-text-link" to={me ? '/settings' : '/signup'}>
          {me ? 'Settings' : 'Back To Signup'}
        </Link>
      </div>
    </AuthFrame>
  );
}
