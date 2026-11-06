import { useId, type ReactNode } from 'react';
export function ListGroup({
  header,
  footer,
  children,
}: {
  header?: string;
  footer?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={header ? id : undefined} className="ui-list-group">
      {header && (
        <h2 id={id} className="ui-group-caption">
          {header}
        </h2>
      )}
      <div className="ui-list">{children}</div>
      {footer && <p className="ui-group-caption">{footer}</p>}
    </section>
  );
}
