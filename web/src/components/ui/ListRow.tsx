import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
export type ListRowProps = {
  title: string;
  subtitle?: ReactNode;
  leading?: ReactNode;
  avatar?: ReactNode;
  trailing?: ReactNode;
  to?: string;
  chevron?: boolean;
  onClick?: () => void;
  tone?: 'default' | 'destructive';
};
export function ListRow({
  title,
  subtitle,
  leading,
  avatar,
  trailing,
  to,
  chevron = !!to,
  onClick,
  tone = 'default',
}: ListRowProps) {
  const content = (
    <>
      {avatar ||
        (leading && (
          <span className="ui-icon-tile" aria-hidden="true">
            {leading}
          </span>
        ))}
      <span className="min-w-0 flex-1">
        <span className="block">{title}</span>
        {subtitle && <span className="block text-footnote text-muted">{subtitle}</span>}
      </span>
      {trailing && <span className="text-subhead text-muted tabular-nums">{trailing}</span>}
      {chevron && (
        <ChevronRight
          aria-hidden="true"
          size={20}
          strokeWidth={1.75}
          className="shrink-0 text-muted"
        />
      )}
    </>
  );
  const className = `ui-row ${tone === 'destructive' ? 'text-accent-ink' : ''}`;
  return to ? (
    <Link to={to} className={className}>
      {content}
    </Link>
  ) : onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}
