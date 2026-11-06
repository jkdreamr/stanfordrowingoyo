import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe } from '../../lib/queries';
import { isUnauthorized } from '../../lib/auth';
import { Button, EmptyState } from '../ui';
import { WifiOff } from 'lucide-react';
import { ShellSkeleton } from './ShellSkeleton';
export function RequireAuth() {
  const query = useMe();
  const location = useLocation();
  const next = encodeURIComponent(location.pathname + location.search + location.hash);
  if (query.isPending) return <ShellSkeleton />;
  if (isUnauthorized(query.error)) return <Navigate to={`/login?next=${next}`} replace />;
  if (query.isError)
    return (
      <EmptyState
        icon={<WifiOff size={20} strokeWidth={1.75} />}
        title="Could Not Load Your Account"
        body="Check your connection and try again"
        action={<Button onClick={() => void query.refetch()}>Try Again</Button>}
      />
    );
  if (query.data.must_change_password)
    return <Navigate to={`/change-password?next=${next}`} replace />;
  return <Outlet />;
}
