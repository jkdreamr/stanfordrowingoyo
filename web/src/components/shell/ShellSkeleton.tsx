import { Skeleton } from '../ui';
export function ShellSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading Your Training"
      aria-busy="true"
      className="shell-loading"
    >
      <div className="hidden lg:block">
        <Skeleton className="h-8 w-40" />
        <div className="mt-8 space-y-4">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-12" />
          ))}
        </div>
      </div>
      <div className="space-y-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}
