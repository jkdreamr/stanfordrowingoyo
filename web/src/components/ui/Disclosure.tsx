import { ChevronDown } from 'lucide-react';
import { useId, type ReactNode } from 'react';
export function Disclosure({
  title,
  open,
  onChange,
  children,
}: {
  title: string;
  open: boolean;
  onChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="ui-disclosure">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => onChange(!open)}>
        <span>{title}</span>
        <ChevronDown
          aria-hidden="true"
          size={20}
          strokeWidth={1.75}
          className={open ? 'rotate-180' : ''}
        />
      </button>
      <div id={id} hidden={!open} className="space-y-5 p-4 pt-0">
        {children}
      </div>
    </section>
  );
}
