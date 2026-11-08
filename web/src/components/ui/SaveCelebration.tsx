import { useEffect, useState } from 'react';
import { clearSave, useSavedSession } from '../../lib/saveCelebration';
import { formatNumber, formatPercent } from '../../lib/format';
import { Ticker } from './Ticker';

const visibleFor = 1900;

export function SaveCelebration() {
  const session = useSavedSession();
  const [leaving, setLeaving] = useState(false);
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (!session) return;
    setLeaving(false);
    setFilled(false);
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setFilled(true)));
    const leave = setTimeout(() => setLeaving(true), visibleFor);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(leave);
    };
  }, [session]);
  useEffect(() => {
    if (!session) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setLeaving(true);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session]);
  if (!session) return null;
  const hasProgress = session.after !== undefined;
  const ratio = Math.min(1, ((filled ? session.after : session.before) ?? 0) / 100);
  return (
    // A visual moment only: the "Session saved" toast is the announcement of record and the
    // Home celebration card announces any achievement, so screen readers hear each once.
    <div
      className={`save-celebration ${leaving ? 'is-leaving' : ''}`}
      aria-hidden="true"
      onClick={() => setLeaving(true)}
      onAnimationEnd={(event) => {
        if (leaving && event.target === event.currentTarget) clearSave();
      }}
    >
      <div className="save-card">
        <div className="save-mark" aria-hidden="true">
          <span className="drive-puddle" />
          <span className="drive-puddle" />
          <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
            <circle cx="42" cy="42" r="40" stroke="currentColor" strokeWidth="3" opacity="0.9" />
            <path
              d="M28 43.5 37.5 53 57 33"
              stroke="currentColor"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="text-title2">Session Saved</p>
        <p className="mt-1 text-subhead drive-hero-soft">{session.title}</p>
        <p className="mt-5 text-display">
          <Ticker value={session.equiv_m} format={(n) => `+${formatNumber(n)}`} duration={1000} />
        </p>
        <p className="mt-1 text-footnote drive-hero-soft">E-meters</p>
        {hasProgress && (
          <>
            <div className="save-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${ratio})` }} />
            </div>
            <p className="mt-2 text-footnote drive-hero-soft">
              {formatPercent(session.after!)} of weekly target
            </p>
          </>
        )}
      </div>
    </div>
  );
}
