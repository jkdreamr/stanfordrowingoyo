import { WifiOff } from 'lucide-react';
import { Button, EmptyState, Skeleton } from '../ui';
export function LoadState({ error, retry }: { error?: boolean; retry?: () => void }) {
  return error ? (
    <EmptyState
      icon={<WifiOff size={20} strokeWidth={1.75} />}
      title="Could Not Load This Screen"
      body="Check your connection and try again"
      action={<Button onClick={retry}>Try Again</Button>}
    />
  ) : (
    <div role="status" aria-label="Loading" className="space-y-5 p-4">
      <Skeleton className="h-64" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
    </div>
  );
}
