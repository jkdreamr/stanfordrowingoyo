import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';
type Common = {
  variant?: 'primary' | 'secondary' | 'plain' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  leading?: ReactNode;
  children: ReactNode;
  className?: string;
};
export type ButtonProps = Common &
  (
    | (ButtonHTMLAttributes<HTMLButtonElement> & { to?: never })
    | (Omit<LinkProps, 'children'> & { to: string; disabled?: boolean })
  );
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  leading,
  children,
  className,
  ...props
}: ButtonProps) {
  const classes = cn(
    'ui-button',
    `ui-button-${variant}`,
    `ui-button-${size}`,
    fullWidth && 'w-full',
    className,
  );
  const content = (
    <>
      <span className={loading ? 'invisible flex items-center gap-2' : 'flex items-center gap-2'}>
        {leading && <span aria-hidden="true">{leading}</span>}
        {children}
      </span>
      {loading && (
        <LoaderCircle aria-hidden="true" className="ui-spinner" size={20} strokeWidth={1.75} />
      )}
    </>
  );
  if (props.to !== undefined) {
    const { disabled, ...link } = props;
    return (
      <Link
        {...link}
        className={classes}
        aria-busy={loading || undefined}
        aria-disabled={disabled || loading || undefined}
        onClick={(e) => {
          if (disabled || loading) e.preventDefault();
          else link.onClick?.(e);
        }}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
    >
      {content}
    </button>
  );
}
