import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, EmptyState, Skeleton } from '../ui';
export function LoadState({ error, retry }: { error?: boolean; retry?: () => void }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(timer);
  }, []);
  return error ? (
    <EmptyState
      icon={<WifiOff size={20} strokeWidth={1.75} />}
      title="Could Not Load This Screen"
      body="Check your connection and try again"
      action={<Button onClick={retry}>Try Again</Button>}
    />
  ) : (
    <div role="status" aria-label="Loading" aria-busy={!slow} className="space-y-5 p-4">
      <Skeleton className="h-64" />
      <Skeleton className="h-28" />
      {slow && (
        <div>
          <p className="text-subhead text-muted">Still loading</p>
          {retry && (
            <Button variant="secondary" onClick={retry}>
              Refresh
            </Button>
          )}
        </div>
      )}
      <Skeleton className="h-28" />
    </div>
  );
}
