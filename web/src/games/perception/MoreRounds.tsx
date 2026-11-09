import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  PERCEPTION_BEAT_FLASHES,
  PERCEPTION_BEAT_FLASH_MS,
  PERCEPTION_EXPOSURE,
  type PerceptionRoundAnswer,
  type PerceptionV3Puzzle,
} from '../../../../shared/games/perceptionV2';
import { Button } from '../../components/ui';
import { useShowFor, type RoundProps } from './PerceptionPlay';

export const MORE_TITLES = {
  ratio: 'Size Ratio',
  beat: 'Keep the Beat',
  path: 'Path Predict',
  order: 'Flash Order',
  duration: 'Duration Recall',
  centroid: 'Center Point',
} as const;
type MoreId = keyof typeof MORE_TITLES;
const INSTRUCTIONS: Record<MoreId, string> = {
  ratio: 'Remember the circles, then estimate the smaller area as a percentage of the larger.',
  beat: 'Watch four flashes, then tap four more times at the same tempo.',
  path: 'Follow the dot, then mark where it would cross the right edge.',
  order: 'Remember the flashing tiles, then tap them in the same order.',
  duration: 'Remember how long the bar appears, then hold for the same duration.',
  centroid: 'Remember the dots, then mark their center of mass.',
};
const PROMPTS: Record<MoreId, string> = {
  ratio: 'How Large Was the Smaller Area?',
  beat: 'Keep the Same Beat',
  path: 'Place the Crossing Point',
  order: 'Tap the Tiles in Order',
  duration: 'Hold for the Duration You Saw',
  centroid: 'Place the Center of the Dots',
};
const clamp = (n: number, min = 0, max = 1000) => Math.round(Math.max(min, Math.min(max, n)));
const pos = (p: readonly number[]) => ({ left: `${p[0] / 10}%`, top: `${p[1] / 10}%` });

export function MoreRound({
  round,
  puzzle: p,
  stage,
  setStage,
  lockIn,
}: RoundProps & { round: MoreId; puzzle: Partial<PerceptionV3Puzzle> }) {
  const [ratio, setRatio] = useState(50);
  const [elapsed, setElapsed] = useState(0);
  const [mark, setMark] = useState<[number, number] | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [beat, setBeat] = useState<number[]>([]);
  const [holding, setHolding] = useState(false);
  const [held, setHeld] = useState(0);
  const origin = useRef(0),
    lastTap = useRef(0),
    taps = useRef<number[]>([]),
    holdStart = useRef<number | null>(null),
    sent = useRef(false);
  const canvas = useRef<HTMLDivElement>(null);
  const interval = p.beatIntervalMs ?? 650;
  const exposure =
    round === 'beat'
      ? PERCEPTION_BEAT_FLASHES * interval
      : round === 'order'
        ? (p.order?.length ?? 6) * PERCEPTION_EXPOSURE.order
        : round === 'duration'
          ? (p.durationMs ?? 1000)
          : PERCEPTION_EXPOSURE[round];
  useShowFor(stage, exposure, setStage);
  useEffect(() => {
    if (stage !== 'show') return;
    origin.current = performance.now();
    lastTap.current =
      origin.current + PERCEPTION_BEAT_FLASHES * interval - PERCEPTION_BEAT_FLASH_MS;
    if (!['beat', 'path', 'order'].includes(round)) return;
    let frame = 0;
    const tick = () => {
      const ms = performance.now() - origin.current;
      setElapsed(Math.min(ms, exposure));
      if (ms < exposure) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stage, round, exposure, interval]);
  const showing = stage === 'show',
    answering = stage === 'answer',
    reveal = stage === 'reveal';
  const submit = (answer: PerceptionRoundAnswer) => {
    if (!answering || sent.current) return;
    sent.current = true;
    lockIn(answer);
  };
  const tap = () => {
    if (!answering || sent.current || taps.current.length === 4) return;
    const now = performance.now(),
      ms = Math.round(now - lastTap.current);
    if (ms < 100) return;
    lastTap.current = now;
    const next = [...taps.current, Math.min(3000, ms)];
    taps.current = next;
    setBeat(next);
    if (next.length === 4) submit({ beatMs: [next[0], next[1], next[2], next[3]] });
  };
  const beginHold = () => {
    if (!answering || sent.current || holdStart.current !== null) return;
    holdStart.current = performance.now();
    setHolding(true);
  };
  const cancelHold = () => {
    holdStart.current = null;
    setHolding(false);
  };
  const finishHold = () => {
    if (holdStart.current === null) return;
    const ms = clamp(performance.now() - holdStart.current, 0, 10000);
    cancelHold();
    setHeld(ms);
    submit({ durationMs: ms });
  };
  const place = (e: PointerEvent<HTMLDivElement>) => {
    if (!answering || sent.current || (e.type === 'pointermove' && !e.buttons)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const box = canvas.current!.getBoundingClientRect();
    setMark([
      round === 'path' ? 1000 : clamp(((e.clientX - box.left) / box.width) * 1000),
      clamp(((e.clientY - box.top) / box.height) * 1000),
    ]);
  };
  const flash = Math.floor((elapsed + PERCEPTION_BEAT_FLASH_MS) / interval);
  const lit =
    flash >= 1 &&
    flash <= 4 &&
    elapsed >= flash * interval - PERCEPTION_BEAT_FLASH_MS &&
    elapsed < flash * interval;
  const path = p.path;
  const moving = path
    ? [
        path.from[0] + ((path.to[0] - path.from[0]) * elapsed) / exposure,
        path.from[1] + ((path.to[1] - path.from[1]) * elapsed) / exposure,
      ]
    : [0, 0];
  const targetRatio = p.ratioDiameters
    ? Math.round(100 * (Math.min(...p.ratioDiameters) / Math.max(...p.ratioDiameters)) ** 2)
    : 0;
  return (
    <>
      <p className="pc-brief">
        {stage === 'brief'
          ? INSTRUCTIONS[round]
          : showing
            ? round === 'beat'
              ? 'Watch the Beat'
              : round === 'path'
                ? 'Follow the Dot'
                : 'Look Carefully'
            : answering
              ? PROMPTS[round]
              : 'Your Answer'}
      </p>
      {stage === 'brief' ? (
        <Button fullWidth size="lg" onClick={() => setStage('show')}>
          Start
        </Button>
      ) : (
        <>
          {round === 'ratio' && (showing || reveal) && (
            <div className="pc-board pc-v3-board" role="img" aria-label="Two Circles">
              <svg viewBox="0 0 1000 1000" aria-hidden="true">
                {p.ratioDiameters?.map((diameter, i) => (
                  <circle
                    key={i}
                    className="pc-ratio-circle"
                    cx={i ? 750 : 250}
                    cy="500"
                    r={diameter / 2}
                  />
                ))}
              </svg>
            </div>
          )}
          {round === 'ratio' && answering && (
            <div className="pc-ratio-answer">
              <output className="pc-value" aria-label="Your Area Percentage">
                {ratio}%
              </output>
              <label className="pc-slider-label">
                Area Percentage
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={ratio}
                  aria-valuenow={ratio}
                  aria-label="Area Percentage"
                  className="pc-slider"
                  data-no-tab-swipe
                  onChange={(e) => setRatio(Number(e.target.value))}
                />
              </label>
            </div>
          )}
          {round === 'beat' && showing && (
            <div className="pc-hold pc-v3-pad" role="img" aria-label="Beat Flashes">
              <span className={`pc-beat-light${lit ? ' pc-beat-lit' : ''}`} />
            </div>
          )}
          {round === 'beat' && answering && (
            <>
              <button
                type="button"
                className="pc-react pc-v3-pad"
                data-no-tab-swipe
                aria-label="Continue the Beat"
                onPointerDown={(e) => {
                  e.preventDefault();
                  tap();
                }}
                onClick={(e) => {
                  if (e.detail === 0) tap();
                }}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    if (!e.repeat) tap();
                  }
                }}
              >
                Tap
              </button>
              <p className="pc-detail" role="status">
                {beat.length} of 4 Taps
              </p>
            </>
          )}
          {round === 'duration' && showing && (
            <div className="pc-board pc-v3-board pc-length" role="img" aria-label="Duration Bar">
              <span className="pc-bar-horizontal" style={{ width: '70%' }} />
            </div>
          )}
          {round === 'duration' && answering && (
            <button
              type="button"
              className={`pc-hold pc-v3-pad${holding ? ' pc-hold-on' : ''}`}
              data-no-tab-swipe
              aria-label="Press and Hold"
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture?.(e.pointerId);
                beginHold();
              }}
              onPointerUp={finishHold}
              onPointerCancel={cancelHold}
              onLostPointerCapture={cancelHold}
              onBlur={cancelHold}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  if (!e.repeat) beginHold();
                }
              }}
              onKeyUp={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  finishHold();
                }
              }}
            >
              {holding ? 'Release to Finish' : 'Press and Hold'}
            </button>
          )}
          {(round === 'path' || round === 'centroid') && (
            <div
              className={`pc-board pc-v3-board${answering ? ' pc-board-live' : ''}`}
              data-no-tab-swipe
              role={answering ? (round === 'path' ? 'slider' : 'button') : 'img'}
              tabIndex={answering ? 0 : undefined}
              aria-label={round === 'path' ? 'Crossing Position' : 'Center Position'}
              aria-description="Tap or drag the marker. Use arrow keys to adjust its position."
              aria-valuemin={answering && round === 'path' ? 0 : undefined}
              aria-valuemax={answering && round === 'path' ? 1000 : undefined}
              aria-valuenow={answering && round === 'path' ? (mark?.[1] ?? 500) : undefined}
              aria-orientation={answering && round === 'path' ? 'vertical' : undefined}
              onPointerDown={place}
              onPointerMove={place}
              onKeyDown={(e) => {
                if (!answering || sent.current) return;
                const steps: Record<string, [number, number]> = {
                  ArrowLeft: [-10, 0],
                  ArrowRight: [10, 0],
                  ArrowUp: [0, -10],
                  ArrowDown: [0, 10],
                  ' ': [0, 0],
                  Enter: [0, 0],
                };
                const delta = steps[e.key];
                if (!delta) return;
                e.preventDefault();
                const prev = mark ?? [500, 500];
                setMark([
                  round === 'path' ? 1000 : clamp(prev[0] + delta[0]),
                  clamp(prev[1] + delta[1]),
                ]);
              }}
            >
              <div className="pc-v3-canvas" ref={canvas}>
                {round === 'path' && (
                  <svg viewBox="0 0 1000 1000" aria-hidden="true">
                    <line x1="1000" x2="1000" y1="0" y2="1000" />
                    {showing && (
                      <circle className="pc-path-dot" cx={moving[0]} cy={moving[1]} r="20" />
                    )}
                    {reveal && path && (
                      <line
                        className="pc-path-trace"
                        x1={path.from[0]}
                        y1={path.from[1]}
                        x2="1000"
                        y2={
                          path.from[1] +
                          ((1000 - path.from[0]) * (path.to[1] - path.from[1])) /
                            (path.to[0] - path.from[0])
                        }
                      />
                    )}
                  </svg>
                )}
                {round === 'centroid' &&
                  (showing || reveal) &&
                  p.centroidDots?.map((point, i) => (
                    <span key={i} className="pc-count-dot" style={pos(point)} />
                  ))}
                {mark && <span className="pc-mark" style={pos(mark)} />}
                {reveal && (
                  <span
                    className="pc-dot pc-v3-target"
                    style={pos(
                      round === 'path' && path
                        ? [
                            1000,
                            path.from[1] +
                              ((1000 - path.from[0]) * (path.to[1] - path.from[1])) /
                                (path.to[0] - path.from[0]),
                          ]
                        : p.centroidDots
                          ? [0, 1].map((i) =>
                              Math.round(
                                p.centroidDots!.reduce((sum, point) => sum + point[i], 0) /
                                  p.centroidDots!.length,
                              ),
                            )
                          : [500, 500],
                    )}
                  />
                )}
              </div>
            </div>
          )}
          {round === 'order' && (
            <>
              <div
                className="pc-grid pc-order-grid"
                role="group"
                aria-label="Tile Sequence"
                data-no-tab-swipe
              >
                {Array.from({ length: 16 }, (_, cell) => {
                  const index = (reveal ? (p.order ?? []) : order).indexOf(cell),
                    on = showing
                      ? p.order?.[Math.floor(elapsed / PERCEPTION_EXPOSURE.order)] === cell
                      : index >= 0;
                  return (
                    <button
                      type="button"
                      className={`pc-cell${on ? ' pc-cell-on' : ''}`}
                      key={cell}
                      disabled={!answering}
                      aria-label={`Tile ${cell + 1}`}
                      aria-pressed={answering ? index >= 0 : undefined}
                      onClick={() => {
                        if (!sent.current && order.length < 10 && !order.includes(cell))
                          setOrder([...order, cell]);
                      }}
                    >
                      {!showing && index >= 0 && <span>{index + 1}</span>}
                    </button>
                  );
                })}
              </div>
              {answering && (
                <div className="pc-order-tools">
                  <output aria-live="polite">{order.length} Selected</output>
                  <Button
                    variant="secondary"
                    disabled={!order.length}
                    onClick={() => setOrder(order.slice(0, -1))}
                  >
                    Undo
                  </Button>
                  <Button variant="secondary" disabled={!order.length} onClick={() => setOrder([])}>
                    Clear
                  </Button>
                </div>
              )}
            </>
          )}
          {answering && (round === 'path' || round === 'centroid') && (
            <p className="pc-detail">Tap or Drag the Marker</p>
          )}
          {answering && ['ratio', 'path', 'order', 'centroid'].includes(round) && (
            <Button
              fullWidth
              size="lg"
              disabled={
                round === 'path' || round === 'centroid'
                  ? !mark
                  : round === 'order'
                    ? !order.length
                    : false
              }
              onClick={() =>
                submit(
                  round === 'ratio'
                    ? { ratio }
                    : round === 'path'
                      ? { pathY: mark![1] }
                      : round === 'centroid'
                        ? { centroid: mark! }
                        : { order },
                )
              }
            >
              Lock In
            </Button>
          )}
          {reveal && (
            <p className="pc-detail">
              {round === 'ratio' ? (
                `Yours ${ratio}% · Target ${targetRatio}%`
              ) : round === 'beat' ? (
                `Yours ${beat.join(', ')} ms · Target ${interval} ms per Tap`
              ) : round === 'duration' ? (
                `Yours ${held} ms · Target ${p.durationMs} ms`
              ) : round === 'order' ? (
                <>
                  Yours {order.map((n) => n + 1).join(', ')}
                  <br />
                  Target {p.order?.map((n) => n + 1).join(', ')}
                </>
              ) : (
                'Your Ring · Target Dot'
              )}
            </p>
          )}
        </>
      )}
    </>
  );
}
