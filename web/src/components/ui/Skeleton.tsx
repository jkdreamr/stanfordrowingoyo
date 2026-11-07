import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} aria-hidden="true" className={cn('ui-skeleton', className)} />;
}
