import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
export function IconButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string }) {
  return <button type="button" {...props} className={cn('ui-icon-button', className)} />;
}
