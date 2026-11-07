import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
export function IconButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string }) {
  return (
    <button type="button" {...props} className={cn('ui-icon-button', className)}>
      <span aria-hidden="true" className="inline-flex">
        {children}
      </span>
    </button>
  );
}
