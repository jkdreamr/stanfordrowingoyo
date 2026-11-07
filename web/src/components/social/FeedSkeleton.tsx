import { useEffect, useState } from 'react';
import { Card, Skeleton } from '../ui';
export function FeedSkeleton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div aria-busy="true" className="space-y-4">
      <span role="status" className="sr-only">
        Loading workouts
      </span>
      {visible &&
        [0, 1].map((n) => (
          <Card key={n}>
            <div className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="my-4 h-7 w-48" />
            <Skeleton className="my-4 h-16" />
            <Skeleton className="aspect-[4/3] w-full" />
          </Card>
        ))}
    </div>
  );
}
