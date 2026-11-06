import type { ReactNode } from 'react';
export function ProgressRing({
  value,
  max,
  label,
  children,
  size = 144,
}: {
  value: number;
  max: number;
  label: string;
  children?: ReactNode;
  size?: number;
}) {
  const valid = Number.isFinite(value) && Number.isFinite(max) && max > 0;
  const ratio = valid ? Math.max(0, Math.min(1, value / max)) : 0;
  const circumference = 2 * Math.PI * 44;
  return (
    <div
      className="ui-ring"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={valid ? max : 1}
      aria-valuenow={valid ? Math.max(0, Math.min(max, value)) : 0}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill="none" stroke="var(--surface-2)" strokeWidth="7" />
        <circle
          className="ui-ring-stroke"
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke={ratio === 1 ? 'var(--highlight)' : 'var(--accent)'}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="ui-ring-center">{children}</div>
    </div>
  );
}
