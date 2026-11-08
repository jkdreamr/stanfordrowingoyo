import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Moon, Sun } from 'lucide-react';

/** Knob travel in px: track 76 − knob 32 − 2 × 4 px inset. */
const TRAVEL = 36;
/** Movement below this many px is a tap, not a drag. */
const TAP_SLOP = 4;
/** How far past either end the knob follows the finger, as a fraction of the overdrag. */
const RUBBER_BAND = 0.22;
/** Release projects the position this many seconds ahead before choosing a side. */
const PROJECTION_S = 0.15;

const band = (p: number) => (p < 0 ? p * RUBBER_BAND : p > 1 ? 1 + (p - 1) * RUBBER_BAND : p);

/**
 * The glass light switch: light on the left, dark on the right. A native switch button, so
 * Space, Enter, labels and screen readers behave as they should; ArrowLeft and ArrowRight
 * choose a side, and the knob can be dragged (with a rubber band past the ends) or tapped.
 * An original implementation; proportions and timing are informed by Zsolt Kacso's
 * Glass Light Toggle, without its WebGL, bloom, grain or overshooting spring.
 */
export function ThemeSwitch({
  id,
  dark,
  onChange,
  disabled = false,
  ...aria
}: {
  id?: string;
  dark: boolean;
  onChange: (dark: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const gesture = useRef<{
    id: number;
    x: number;
    from: number;
    at: number;
    moved: boolean;
    samples: { x: number; t: number }[];
  } | null>(null);
  const swallowClick = useRef(false);
  const position = drag ?? (dark ? 1 : 0);
  const side = position > 0.5 ? 'dark' : 'light';

  const end = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    gesture.current = null;
    if (!g.moved) return;
    swallowClick.current = true;
    const now = event.timeStamp;
    const first = g.samples.find((s) => now - s.t <= 100) ?? g.samples[0];
    const velocity =
      first && now > first.t ? (event.clientX - first.x) / TRAVEL / ((now - first.t) / 1000) : 0;
    const projected = g.at + velocity * PROJECTION_S;
    setDrag(null);
    const next = cancelled ? dark : projected > 0.5;
    if (next !== dark) onChange(next);
  };

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={dark}
      disabled={disabled}
      className="glass-switch"
      data-side={side}
      data-dragging={drag !== null ? '' : undefined}
      style={{ '--p': position } as CSSProperties}
      {...aria}
      onClick={() => {
        if (swallowClick.current) {
          swallowClick.current = false;
          return;
        }
        onChange(!dark);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const next = event.key === 'ArrowRight';
        if (next !== dark) onChange(next);
      }}
      onPointerDown={(event) => {
        if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
        swallowClick.current = false;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        gesture.current = {
          id: event.pointerId,
          x: event.clientX,
          from: dark ? 1 : 0,
          at: dark ? 1 : 0,
          moved: false,
          samples: [{ x: event.clientX, t: event.timeStamp }],
        };
      }}
      onPointerMove={(event) => {
        const g = gesture.current;
        if (!g || g.id !== event.pointerId) return;
        const dx = event.clientX - g.x;
        if (!g.moved && Math.abs(dx) < TAP_SLOP) return;
        g.moved = true;
        g.samples = [
          ...g.samples.filter((s) => event.timeStamp - s.t <= 100),
          { x: event.clientX, t: event.timeStamp },
        ];
        g.at = band(g.from + dx / TRAVEL);
        setDrag(g.at);
      }}
      onPointerUp={(event) => end(event)}
      onPointerCancel={(event) => end(event, true)}
    >
      <span className="glass-switch-track" aria-hidden="true">
        <Sun className="glass-switch-floor is-sun" size={14} strokeWidth={2} />
        <Moon className="glass-switch-floor is-moon" size={14} strokeWidth={2} />
      </span>
      <span className="glass-switch-knob" aria-hidden="true">
        <Sun className="glass-switch-icon is-sun" size={16} strokeWidth={2} />
        <Moon className="glass-switch-icon is-moon" size={16} strokeWidth={2} />
        <span className="glass-switch-indicator" />
      </span>
    </button>
  );
}
