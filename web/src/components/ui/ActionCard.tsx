import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
export function ActionCard({
  to,
  label,
  children,
}: {
  to: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} aria-label={label} className="ui-card ui-action-card">
      {children}
    </Link>
  );
}
