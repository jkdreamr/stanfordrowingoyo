import { useEffect, useRef } from 'react';
export function FormErrors({
  message,
  fields = {},
}: {
  message?: string;
  fields?: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const active = !!message || Object.keys(fields).length > 0;
  useEffect(() => {
    if (active) ref.current?.focus();
  }, [message, fields, active]);
  if (!active) return null;
  return (
    <div role="alert" ref={ref} tabIndex={-1} className="form-errors text-subhead">
      <p>{message || 'Check the highlighted fields'}</p>
      {Object.entries(fields).map(([id, error]) => (
        <a
          key={id}
          href={`#${id}`}
          className="mt-2 block underline underline-offset-4"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(id)?.focus();
          }}
        >
          {error}
        </a>
      ))}
    </div>
  );
}
