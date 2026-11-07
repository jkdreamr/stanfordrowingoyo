import { Outlet } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useMe } from '../../lib/queries';
import { Button, EmptyState, PageHeader } from '../ui';
import { LoadState } from './LoadState';

export function RequireStaff() {
  const me = useMe();
  if (!me.data) return <LoadState error={me.isError} retry={() => void me.refetch()} />;
  if (me.data.role !== 'rower') return <Outlet />;
  return (
    <>
      <PageHeader title="Admin" />
      <EmptyState
        icon={<Shield size={20} strokeWidth={1.75} />}
        title="Staff Only"
        body="Ask a coxswain for access."
        action={<Button to="/">Back To Home</Button>}
      />
    </>
  );
}
