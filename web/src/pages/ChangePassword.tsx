import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useMe } from '../lib/queries';
import { isUnauthorized, safeNext } from '../lib/auth';
import { AuthFrame } from '../components/auth/AuthLayout';
import { ChangePasswordForm } from '../components/auth/ChangePasswordForm';
import { ShellSkeleton } from '../components/shell/ShellSkeleton';
export default function ChangePassword() {
  const query = useMe();
  const location = useLocation();
  const next = safeNext(location.search);
  const navigate = useNavigate();
  if (query.isPending) return <ShellSkeleton />;
  if (isUnauthorized(query.error))
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  if (query.data && !query.data.must_change_password) return <Navigate to={next} replace />;
  return (
    <AuthFrame title="Change Your Password" subtitle="Set a new password to continue.">
      <ChangePasswordForm forced onSuccess={() => navigate(next, { replace: true })} />
    </AuthFrame>
  );
}
