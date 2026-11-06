import type { ReactNode } from 'react';
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty">
      <span aria-hidden="true">{icon}</span>
      <h2 className="text-title3">{title}</h2>
      <p className="text-muted">{body}</p>
      {action}
    </div>
  );
}
