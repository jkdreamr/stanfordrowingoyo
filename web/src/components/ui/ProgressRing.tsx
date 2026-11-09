import { useEffect, useState, type ReactNode } from 'react';
import { formatMeters } from '../../lib/format';
import { afterLaunch, lastShown, remember } from '../../lib/motion';
export function ProgressRing({
  value,
  max,
  label,
  children,
  size = 144,
  previousValue,
  id,
}: {
  value: number;
  max: number;
  label: string;
  children?: ReactNode;
  size?: number;
  previousValue?: number;
  /** Sweeps from empty on the first view in a session, then only animates real changes. */
  id?: string;
}) {
  const key = id && `ring:${id}`;
  const [arcValue, setArcValue] = useState(
    () =>
      previousValue ??
      lastShown(key) ??
      (key && !document.documentElement.hasAttribute('data-entered') ? 0 : value),
  );
  useEffect(() => {
    remember(key, value);
    return afterLaunch(() => setArcValue(value));
  }, [value, key]);
  const valid = Number.isFinite(value) && Number.isFinite(max) && max > 0;
  const ratio = valid ? Math.max(0, Math.min(1, value / max)) : 0;
  const circumference = 2 * Math.PI * 44;
  const arcRatio = valid ? Math.max(0, Math.min(1, arcValue / max)) : 0;
  return (
    <div
      className="ui-ring"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={valid ? max : 1}
      aria-valuenow={valid ? Math.max(0, Math.min(max, value)) : 0}
      aria-valuetext={
        valid
          ? `${formatMeters(value)} of ${formatMeters(max)} E-meters${ratio === 1 ? '. Target hit' : ''}`
          : 'Set a weekly target'
      }
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
          strokeDashoffset={circumference * (1 - arcRatio)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="ui-ring-center">{children}</div>
    </div>
  );
}
