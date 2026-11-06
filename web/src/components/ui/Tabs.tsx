import { useId, useRef, type ReactNode } from 'react';
export type Tab<T extends string> = {
  value: T;
  label: string;
  content: ReactNode;
  disabled?: boolean;
};
export function Tabs<T extends string>({
  label,
  value,
  onChange,
  tabs,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  tabs: readonly Tab<T>[];
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div>
      <div role="tablist" aria-label={label} className="ui-tabs">
        {tabs.map((tab, i) => (
          <button
            type="button"
            key={tab.value}
            id={`${id}-tab-${i}`}
            role="tab"
            aria-selected={value === tab.value}
            aria-controls={`${id}-panel-${i}`}
            disabled={tab.disabled}
            tabIndex={value === tab.value ? 0 : -1}
            ref={(el) => {
              refs.current[i] = el;
            }}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
              e.preventDefault();
              const enabled = tabs.map((t, n) => (t.disabled ? -1 : n)).filter((n) => n >= 0);
              if (!enabled.length) return;
              const next =
                e.key === 'Home'
                  ? enabled[0]
                  : e.key === 'End'
                    ? enabled.at(-1)!
                    : enabled[
                        (enabled.indexOf(i) + (e.key === 'ArrowLeft' ? -1 : 1) + enabled.length) %
                          enabled.length
                      ];
              onChange(tabs[next].value);
              refs.current[next]?.focus();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.value}
          id={`${id}-panel-${i}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${i}`}
          hidden={value !== tab.value}
          tabIndex={0}
          className="py-4"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
