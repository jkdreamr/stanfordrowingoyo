import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  PERCEPTION_EXPOSURE,
  type PerceptionV2Puzzle,
} from '../../../../shared/games/perceptionV2';
import { Button } from '../../components/ui';
import { useShowFor, type RoundProps } from './PerceptionPlay';

export const EXTRA_TITLES = {
  angle: 'Angle Copy',
  length: 'Length Match',
  count: 'Quick Count',
  span: 'Digit Span',
  shade: 'Shade Match',
  bisect: 'Line Midpoint',
  contact: 'Hidden Motion',
} as const;
const INSTRUCTIONS = {
  angle: 'Remember the angle, then set the slider to match.',
  length: 'Remember the horizontal bar, then match its length vertically.',
  count: 'Estimate how many dots appear, then enter your count.',
  span: 'Remember the digits in order, then enter the whole sequence.',
  shade: 'Remember the gray square, then match it on a different background.',
  bisect: 'Place a marker halfway between the two ends of the line.',
  contact: 'Follow the moving dot, then tap when it would reach the finish line.',
};
const ANSWER_PROMPTS = {
  angle: 'Set the Angle You Saw',
  length: 'Set the Bar to the Length You Saw',
  count: 'How Many Dots Were There?',
  span: 'Enter the Digits in Order',
  shade: 'Match the Gray You Saw',
  bisect: 'Place the Midpoint',
  contact: 'Tap When It Reaches the Finish',
};
type ExtraId = keyof typeof EXTRA_TITLES;
const clamp = (n: number, lo = 0, hi = 1000) => Math.max(lo, Math.min(hi, Math.round(n)));
const pos = (p: [number, number]) => ({ left: `${p[0] / 10}%`, top: `${p[1] / 10}%` });

function Slider({
  label,
  value,
  max = 1000,
  min = 0,
  onChange,
}: {
  label: string;
  value: number;
  max?: number;
  min?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="pc-slider-label">
      {label}
      <input
        type="range"
        aria-label={label}
        aria-valuenow={value}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={(e) => {
          const steps: Record<string, number> = {
            ArrowLeft: -1,
            ArrowDown: -1,
            ArrowRight: 1,
            ArrowUp: 1,
          };
          if (steps[e.key]) {
            e.preventDefault();
            onChange(clamp(value + steps[e.key], min, max));
          }
        }}
        data-no-tab-swipe
        className="pc-slider"
      />
    </label>
  );
}
function Keypad({
  value,
  setValue,
  maxLength,
  label,
}: {
  value: string;
  setValue: (v: string) => void;
  maxLength: number;
  label: string;
}) {
  return (
    <div className="pc-number-entry" data-no-tab-swipe>
      <output className="pc-number" aria-label={label} aria-live="polite">
        {value || (
          <span className="text-muted">{label === 'Digits' ? 'Your Sequence' : 'Your Count'}</span>
        )}
      </output>
      <div className="pc-keypad" role="group" aria-label={`${label} Keypad`}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Delete', '0', 'Clear'].map((key) => (
          <button
            type="button"
            key={key}
            disabled={key === 'Delete' || key === 'Clear' ? !value : value.length >= maxLength}
            onClick={() =>
              setValue(key === 'Delete' ? value.slice(0, -1) : key === 'Clear' ? '' : value + key)
            }
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExtraRound({
  round,
  puzzle,
  stage,
  setStage,
  lockIn,
}: RoundProps & { round: ExtraId; puzzle: Partial<PerceptionV2Puzzle> }) {
  const [value, setValue] = useState(round === 'angle' ? 90 : round === 'shade' ? 50 : 500);
  const [digits, setDigits] = useState('');
  const [mark, setMark] = useState<[number, number] | null>(null);
  const [shownDigit, setShownDigit] = useState(0);
  const [motion, setMotion] = useState(0);
  const motionStart = useRef(0);
  const [contactAnswer, setContactAnswer] = useState<number | null>(null);
  const exposure =
    round === 'span'
      ? (puzzle.digits?.length ?? 8) * PERCEPTION_EXPOSURE.span
      : round === 'contact'
        ? (puzzle.contact?.visibleMs ?? 1000)
        : round in PERCEPTION_EXPOSURE
          ? PERCEPTION_EXPOSURE[round as keyof typeof PERCEPTION_EXPOSURE]
          : 0;
  useShowFor(stage, exposure, setStage);
  useEffect(() => {
    if (stage !== 'show' || round !== 'span') return;
    setShownDigit(0);
    const timer = window.setInterval(() => setShownDigit((i) => i + 1), PERCEPTION_EXPOSURE.span);
    return () => window.clearInterval(timer);
  }, [stage, round]);
  useEffect(() => {
    if (stage !== 'show' || round !== 'contact') return;
    motionStart.current = performance.now();
    let frame = 0;
    const tick = () => {
      setMotion(Math.min(1, (performance.now() - motionStart.current) / exposure));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stage, round, exposure]);
  const showing = stage === 'show',
    answering = stage === 'answer',
    reveal = stage === 'reveal';
  const place = (e: PointerEvent<HTMLDivElement>) => {
    if (!answering) return;
    if (e.type === 'pointermove' && !e.buttons) return;
    const box = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setMark([
      clamp(((e.clientX - box.left) / box.width) * 1000),
      clamp(((e.clientY - box.top) / box.height) * 1000),
    ]);
  };
  const target =
    round === 'angle'
      ? puzzle.angle
      : round === 'length'
        ? puzzle.length
        : round === 'shade'
          ? puzzle.shade
          : undefined;
  const angle = showing ? (puzzle.angle ?? 90) : value;
  const rotation = showing ? (puzzle.rotation ?? 0) : 0;
  const ray = (deg: number) => [
    500 + 320 * Math.cos((deg * Math.PI) / 180),
    500 + 320 * Math.sin((deg * Math.PI) / 180),
  ];
  const a = ray(rotation),
    b = ray(rotation + angle);
  const endpoints = puzzle.endpoints ?? [
    [150, 300],
    [850, 700],
  ];
  const midpoint: [number, number] = [
    (endpoints[0][0] + endpoints[1][0]) / 2,
    (endpoints[0][1] + endpoints[1][1]) / 2,
  ];
  const contact = puzzle.contact;
  const submit = () => {
    if (round === 'angle') lockIn({ angle: value });
    else if (round === 'length') lockIn({ length: value });
    else if (round === 'shade') lockIn({ shade: value });
    else if (round === 'count') lockIn({ count: Number(digits) });
    else if (round === 'span') lockIn({ digits });
    else if (round === 'bisect' && mark) lockIn({ bisect: mark });
    else if (round === 'contact' && contact) {
      const ms = clamp(performance.now() - motionStart.current - contact.visibleMs, 0, 6000);
      setContactAnswer(ms);
      lockIn({ contactMs: ms });
    }
  };
  const invalid =
    round === 'bisect'
      ? !mark
      : round === 'count'
        ? Number(digits) < 1 || Number(digits) > 200
        : round === 'span'
          ? !digits
          : false;
  return (
    <>
      <p className="pc-brief">
        {stage === 'brief'
          ? INSTRUCTIONS[round]
          : showing
            ? round === 'span'
              ? 'Remember Each Digit'
              : round === 'contact'
                ? 'Follow the Dot'
                : 'Look Carefully'
            : answering
              ? ANSWER_PROMPTS[round]
              : 'Your Answer'}
      </p>
      {stage !== 'brief' && (
        <>
          {round === 'angle' && (
            <div
              className="pc-board pc-geometry"
              role="img"
              aria-label={showing ? 'Target Angle' : 'Your Angle'}
            >
              <svg viewBox="0 0 1000 1000" aria-hidden="true">
                <path d={`M ${a[0]} ${a[1]} L 500 500 L ${b[0]} ${b[1]}`} />
                <circle cx="500" cy="500" r="16" />
              </svg>
            </div>
          )}
          {round === 'length' && (
            <div
              className="pc-board pc-length"
              role="img"
              aria-label={showing ? 'Reference Bar' : 'Your Vertical Bar'}
            >
              <span
                className={showing ? 'pc-bar-horizontal' : 'pc-bar-vertical'}
                style={
                  showing
                    ? { width: `${(puzzle.length ?? 500) / 10}%` }
                    : { height: `${value / 10}%` }
                }
              />
            </div>
          )}
          {round === 'shade' && (
            <div
              className="pc-shade-field"
              style={{
                background: `hsl(0 0% ${(puzzle.shadeBackgrounds ?? [10, 90])[showing ? 0 : 1]}%)`,
              }}
              role="img"
              aria-label={showing ? 'Target Shade' : 'Your Shade'}
            >
              <span
                style={{ background: `hsl(0 0% ${showing ? (puzzle.shade ?? 50) : value}%)` }}
              />
            </div>
          )}
          {round === 'count' && showing && (
            <div className="pc-board" role="img" aria-label="Dots to Count">
              {puzzle.countDots?.map((p, i) => (
                <span key={i} className="pc-count-dot" style={pos(p)} />
              ))}
            </div>
          )}
          {round === 'span' && showing && (
            <div className="pc-digit-stage" aria-label="Digit Sequence">
              <span key={shownDigit}>{puzzle.digits?.[shownDigit] ?? ''}</span>
              <span className="pc-sub">
                {Math.min(shownDigit + 1, puzzle.digits?.length ?? 8)} of {puzzle.digits?.length}
              </span>
            </div>
          )}
          {(round === 'span' || round === 'count') && answering && (
            <Keypad
              label={round === 'span' ? 'Digits' : 'Count'}
              value={digits}
              setValue={setDigits}
              maxLength={round === 'span' ? 12 : 3}
            />
          )}
          {round === 'bisect' && (
            <div
              className="pc-board pc-board-live"
              role="button"
              tabIndex={answering ? 0 : -1}
              aria-label="Midpoint Position"
              aria-description="Tap or drag the marker. Use arrow keys to adjust its position."
              data-no-tab-swipe
              onPointerDown={place}
              onPointerMove={place}
              onKeyDown={(e) => {
                const deltas: Record<string, [number, number]> = {
                  ArrowLeft: [-10, 0],
                  ArrowRight: [10, 0],
                  ArrowUp: [0, -10],
                  ArrowDown: [0, 10],
                };
                if (answering && deltas[e.key]) {
                  e.preventDefault();
                  const p = mark ?? [500, 500],
                    d = deltas[e.key];
                  setMark([clamp(p[0] + d[0]), clamp(p[1] + d[1])]);
                }
              }}
            >
              <svg viewBox="0 0 1000 1000" aria-hidden="true">
                <line
                  x1={endpoints[0][0]}
                  y1={endpoints[0][1]}
                  x2={endpoints[1][0]}
                  y2={endpoints[1][1]}
                />
              </svg>
              {mark && <span className="pc-mark" style={pos(mark)} />}
              {reveal && <span className="pc-dot" style={pos(midpoint)} />}
            </div>
          )}
          {round === 'bisect' && answering && <p className="pc-detail">Tap or Drag the Marker</p>}
          {round === 'contact' && contact && (
            <div
              className="pc-board pc-motion"
              role="img"
              aria-label="Motion Track and Finish Line"
              style={
                {
                  '--pc-occlusion': `${contact.occlusion[0] / 10}%`,
                  '--pc-finish': `${100 - contact.finish[0] / 10}%`,
                } as CSSProperties
              }
            >
              <svg viewBox="0 0 1000 1000" aria-hidden="true">
                <line
                  className="pc-track"
                  x1={contact.from[0]}
                  y1="500"
                  x2={contact.finish[0]}
                  y2="500"
                />
                <line x1={contact.finish[0]} y1="350" x2={contact.finish[0]} y2="650" />
              </svg>
              <div className="pc-occluder" />
              <span className="pc-finish-label">Finish</span>
              {showing && motion < 1 && (
                <span
                  className="pc-dot"
                  style={pos([
                    contact.from[0] + (contact.occlusion[0] - contact.from[0]) * motion,
                    500,
                  ])}
                />
              )}
            </div>
          )}
          {answering && (round === 'angle' || round === 'length' || round === 'shade') && (
            <>
              {round === 'shade' && <output className="pc-value">{value}%</output>}
              <Slider
                label={round === 'angle' ? 'Angle' : round === 'length' ? 'Length' : 'Lightness'}
                min={round === 'length' ? 1 : 0}
                max={round === 'angle' ? 180 : round === 'shade' ? 100 : 1000}
                value={value}
                onChange={setValue}
              />
            </>
          )}
          {reveal && (
            <p className="pc-detail">
              {target !== undefined
                ? `Yours ${value}${round === 'angle' ? '°' : ''} · Target ${target}${round === 'angle' ? '°' : ''}`
                : round === 'count'
                  ? `Yours ${digits} · Target ${puzzle.countDots?.length}`
                  : round === 'span'
                    ? `Yours ${digits} · Target ${puzzle.digits}`
                    : round === 'contact'
                      ? `Yours ${contactAnswer} ms · Target ${contact?.hiddenMs} ms`
                      : 'Your Ring · Target Dot'}
            </p>
          )}
        </>
      )}
      {stage === 'brief' && (
        <Button
          fullWidth
          size="lg"
          onClick={() => setStage(round === 'bisect' ? 'answer' : 'show')}
        >
          Start
        </Button>
      )}
      {answering && (
        <Button fullWidth size="lg" disabled={invalid} onClick={submit}>
          {round === 'contact' ? 'Tap at Finish' : 'Lock In'}
        </Button>
      )}
    </>
  );
}
