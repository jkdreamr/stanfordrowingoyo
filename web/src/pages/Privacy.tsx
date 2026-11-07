import { Link } from 'react-router-dom';
import { useMe } from '../lib/queries';
import { AuthFrame } from '../components/auth/AuthLayout';
import { Button } from '../components/ui';

const sections = [
  [
    'Sharing With Your Team',
    'Your teammates and staff can see your profile, workouts, photos, tags, comments, kudos and training totals. Workouts cannot be made private.',
  ],
  [
    'Staff Access',
    'Coxswains, coaches and admins can also see account emails and training compliance. Only admins can remove rower accounts.',
  ],
  [
    'Personal Plans',
    'My Fortnight plans are visible only to you. Staff and teammates cannot view them. Passwords and login sessions are not shared with other users.',
  ],
  [
    'Photo Storage',
    'Photos are stored in the team’s Cloudflare database. Profile and workout photos are visible to the team. Unattached uploads are visible only to you. Photos are deleted when removed unless another profile or workout still uses them.',
  ],
  [
    'Your Data',
    'Download your data from Settings. Photo files are not included. Ask an admin to permanently delete your account and its content, including photos and private plans. Tags, mentions and leaderboard results are also removed. We keep an audit record without your name or email. Backups, saved copies and references in other people’s writing may remain.',
  ],
] as const;

export default function Privacy() {
  const { data: me } = useMe();
  return (
    <AuthFrame
      title="Privacy Notice"
      leading={
        <Button to={me ? '/settings' : '/signup'} variant="plain">
          Back
        </Button>
      }
    >
      <div className="space-y-6">
        <p className="text-footnote text-muted">
          Last updated <time dateTime="2026-11-06">November 6, 2026</time>
        </p>
        {sections.map(([title, body]) => (
          <section key={title}>
            <h2 className="text-headline">{title}</h2>
            <p className="mt-2 text-subhead text-muted">{body}</p>
          </section>
        ))}
        <section>
          <h2 className="text-headline">Contact</h2>
          <p className="mt-2 text-subhead text-muted">
            For questions or removal requests, contact a team admin or coxswain in the app.
          </p>
          <Link className="auth-text-link mt-2" to="/team">
            Team Directory
          </Link>
        </section>
        <Link className="auth-text-link" to={me ? '/settings' : '/signup'}>
          {me ? 'Settings' : 'Back To Signup'}
        </Link>
      </div>
    </AuthFrame>
  );
}
