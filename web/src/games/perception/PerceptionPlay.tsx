import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  COLOR_SHOW_MS,
  DOT_SHOW_MS,
  GRID,
  PATTERN_CELLS,
  PATTERN_SHOW_MS,
  PERCEPTION_ROUNDS,
  hueDistance,
  type PerceptionPuzzle,
} from '../../../../shared/games/perception';
import {
  PERCEPTION_V2_FROM,
  PERCEPTION_EXPOSURE,
  type PerceptionRoundId,
  type PerceptionRoundAnswer,
  type PerceptionV2Puzzle,
} from '../../../../shared/games/perceptionV2';
import { ExtraRound, EXTRA_TITLES } from './ExtraRounds';
import { Button } from '../../components/ui';
import { api } from '../../lib/api';
import { LoadState } from '../../components/shell/LoadState';
import type { PerceptionDay } from '../../../../shared/types';
import type { PlayProps } from '../DailyGameFrame';
import './perception.css';

export type Stage = 'brief' | 'show' | 'answer' | 'reveal';

const TITLE: Record<PerceptionRoundId, string> = {
  clock: 'Inner Clock',
  color: 'Color Recall',
  dot: 'Spot Recall',
  pattern: 'Pattern',
  reaction: 'Reaction',
  ...EXTRA_TITLES,
};

const swatch = (hue: number) => `hsl(${hue} 72% 50%)`;
const now = () => performance.now();

export function PerceptionPlay({ date, onComplete }: PlayProps<void>) {
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const keyboard = () => {
      if (surface.current) surface.current.dataset.input = 'keyboard';
    };
    const pointer = () => {
      if (surface.current) surface.current.dataset.input = 'pointer';
    };
    document.addEventListener('keydown', keyboard, true);
    document.addEventListener('pointerdown', pointer, true);
    return () => {
      document.removeEventListener('keydown', keyboard, true);
      document.removeEventListener('pointerdown', pointer, true);
    };
  }, []);
  const [rounds, setRounds] = useState<PerceptionRoundId[]>([...PERCEPTION_ROUNDS]);
  const [extra, setExtra] = useState<Partial<PerceptionV2Puzzle>>({});
  const v2 = date >= PERCEPTION_V2_FROM;
  const [puzzle, setPuzzle] = useState<PerceptionPuzzle>({
    clockMs: 0,
    hue: 0,
    dot: [0, 0],
    cells: [],
    reactionDelayMs: 0,
  });
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>('brief');
  const [scores, setScores] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const apply = (day: PerceptionDay) => {
    if (day.date !== date) {
      setError('A New Day Has Started. Reload to Play.');
      return;
    }
    const order = day.rounds ?? [...PERCEPTION_ROUNDS];
    setRounds(order);
    setScores(order.map((r) => day.scores[r] ?? 0));
    setIndex(Math.min(day.round, 4));
    setStage('brief');
    setLoaded(true);
    if (day.done) complete.current();
  };
  const resume = useCallback(async () => {
    try {
      apply(await api('GET /api/games/perception/today', {}));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could Not Load Round');
    }
  }, [date]);
  useEffect(() => {
    void resume();
  }, [resume]);
  const round = rounds[index];
  const last = index === rounds.length - 1;
  const changeStage = (next: Stage) => {
    if (sending.current) return;
    if (stage !== 'brief') {
      setStage(next);
      return;
    }
    sending.current = true;
    setBusy(true);
    setError('');
    void api('POST /api/games/perception/start', { body: { round: index, date } })
      .then((day) => {
        if (day.date !== date) {
          setError('A New Day Has Started. Reload to Play.');
          return;
        }
        setPuzzle((p) => ({ ...p, ...day.stimulus }));
        setExtra(day.stimulus);
        setStage(next);
      })
      .catch(async (e) => {
        setError(e instanceof Error ? e.message : 'Could Not Start Round');
        await resume();
      })
      .finally(() => {
        sending.current = false;
        setBusy(false);
      });
  };
  const lockIn = (part: PerceptionRoundAnswer) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    void api('POST /api/games/perception/answer', { body: { round: index, date, answer: part } })
      .then((day) => {
        if (day.date !== date) {
          setError('A New Day Has Started. Reload to Play.');
          return;
        }
        setScores(rounds.map((r) => day.scores[r] ?? 0));
        setStage('reveal');
      })
      .catch(async (e) => {
        setError(e instanceof Error ? e.message : 'Could Not Save Round');
        await resume();
      })
      .finally(() => {
        sending.current = false;
        setBusy(false);
      });
  };
  const next = () => {
    if (last) onComplete();
    else {
      setIndex((i) => i + 1);
      setStage('brief');
    }
  };
  if (!loaded) return <LoadState error={Boolean(error)} retry={() => void resume()} />;

  return (
    <div className="pc" ref={surface} data-input="pointer" aria-busy={busy}>
      <fieldset disabled={busy} style={{ display: 'contents' }}>
        {error && <p role="alert">{error}</p>}
        <ol className="pc-progress" aria-label={`Round ${index + 1} of ${rounds.length}`}>
          {rounds.map((r, i) => (
            <li
              key={r}
              className={
                i < index || (i === index && stage === 'reveal')
                  ? 'pc-step-done'
                  : i === index
                    ? 'pc-step-now'
                    : ''
              }
            />
          ))}
        </ol>
        <div className="pc-head">
          <h2 className="text-headline">{TITLE[round]}</h2>
          <span className="text-subhead text-muted tabular-nums">
            {index + 1} / {rounds.length}
          </span>
        </div>
        {round === 'clock' && (
          <ClockRound
            key={round}
            target={puzzle.clockMs}
            stage={stage}
            setStage={changeStage}
            lockIn={lockIn}
          />
        )}
        {round === 'color' && (
          <ColorRound
            key={round}
            hue={puzzle.hue}
            exposure={v2 ? PERCEPTION_EXPOSURE.color : COLOR_SHOW_MS}
            stage={stage}
            setStage={changeStage}
            lockIn={lockIn}
          />
        )}
        {round === 'dot' && (
          <DotRound
            key={round}
            dot={puzzle.dot}
            exposure={v2 ? PERCEPTION_EXPOSURE.dot : DOT_SHOW_MS}
            stage={stage}
            setStage={changeStage}
            lockIn={lockIn}
          />
        )}
        {round === 'pattern' && (
          <PatternRound
            key={round}
            cells={puzzle.cells}
            count={v2 ? 9 : PATTERN_CELLS}
            exposure={v2 ? PERCEPTION_EXPOSURE.pattern : PATTERN_SHOW_MS}
            stage={stage}
            setStage={changeStage}
            lockIn={lockIn}
          />
        )}
        {round === 'reaction' && (
          <ReactionRound
            key={round}
            delay={puzzle.reactionDelayMs}
            stage={stage}
            setStage={changeStage}
            lockIn={lockIn}
          />
        )}
        {round in EXTRA_TITLES && (
          <ExtraRound
            key={round}
            round={round as keyof typeof EXTRA_TITLES}
            puzzle={extra}
            stage={stage}
            setStage={changeStage}
            lockIn={lockIn}
          />
        )}
        {stage === 'reveal' && (
          <div className="pc-reveal">
            <p className="pc-score tabular-nums" role="status">
              <span className="text-title1">{scores[index]}</span>
              <span className="text-subhead text-muted"> / 100</span>
            </p>
            <Button fullWidth size="lg" onClick={next}>
              {last ? 'See Result' : 'Next'}
            </Button>
          </div>
        )}
      </fieldset>
    </div>
  );
}

export interface RoundProps {
  stage: Stage;
  setStage: (s: Stage) => void;
  lockIn: (part: PerceptionRoundAnswer) => void;
}

function StartButton({ onClick, children = 'Start' }: { onClick: () => void; children?: string }) {
  return (
    <Button fullWidth size="lg" onClick={onClick}>
      {children}
    </Button>
  );
}

export function useShowFor(stage: Stage, ms: number, setStage: (s: Stage) => void) {
  useEffect(() => {
    if (stage !== 'show') return;
    const t = window.setTimeout(() => setStage('answer'), ms);
    return () => window.clearTimeout(t);
  }, [stage, ms, setStage]);
}

function ClockRound({ target, stage, setStage, lockIn }: RoundProps & { target: number }) {
  const start = useRef(0);
  const [held, setHeld] = useState<number | null>(null);
  const holding = stage === 'show';
  const seconds = (target / 1000).toFixed(1);
  const down = () => {
    if (stage !== 'answer') return;
    start.current = now();
    setStage('show');
  };
  const up = () => {
    if (stage !== 'show') return;
    const ms = Math.min(30_000, Math.round(now() - start.current));
    setHeld(ms);
    lockIn({ clockMs: ms });
  };
  const onKey = (e: ReactKeyboardEvent, isDown: boolean) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (isDown && !e.repeat) down();
    else if (!isDown) up();
  };
  return (
    <>
      <p className="pc-brief">
        {stage === 'brief' ? 'Get Ready to Hold' : `Hold for ${seconds} seconds`}
      </p>
      {stage === 'brief' && (
        <p className="pc-instruction">
          Hold the panel for the target time without counting on screen.
        </p>
      )}
      {stage === 'brief' ? (
        <StartButton onClick={() => setStage('answer')}>Ready</StartButton>
      ) : (
        <button
          type="button"
          className={'pc-hold' + (holding ? ' pc-hold-on' : '')}
          data-no-tab-swipe
          disabled={stage === 'reveal'}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            down();
          }}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={(e) => onKey(e, true)}
          onKeyUp={(e) => onKey(e, false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {stage === 'reveal' && held !== null ? (
            <span className="tabular-nums">
              {(held / 1000).toFixed(2)} s<span className="pc-sub">Target {seconds} s</span>
            </span>
          ) : holding ? (
            'Holding'
          ) : (
            'Press and Hold'
          )}
        </button>
      )}
    </>
  );
}

const colorStart = (hue: number) => (hue + 150 + (hue % 60)) % 360;

function ColorRound({
  hue,
  exposure,
  stage,
  setStage,
  lockIn,
}: RoundProps & { hue: number; exposure: number }) {
  const [pick, setPick] = useState(() => colorStart(hue));
  useEffect(() => setPick(colorStart(hue)), [hue]);
  useShowFor(stage, exposure, setStage);
  return (
    <>
      <p className="pc-brief">
        {stage === 'brief'
          ? 'Remember the color, then move the slider to match.'
          : stage === 'show'
            ? 'Remember This Color'
            : 'Match the Color'}
      </p>
      <div className="pc-swatches" aria-hidden={stage === 'show' ? undefined : 'true'}>
        {stage === 'show' && (
          <div
            className="pc-swatch"
            style={{ background: swatch(hue) }}
            role="img"
            aria-label="Target Color"
          />
        )}
        {(stage === 'answer' || stage === 'reveal') && (
          <div className="pc-swatch" style={{ background: swatch(pick) }} />
        )}
        {stage === 'reveal' && <div className="pc-swatch" style={{ background: swatch(hue) }} />}
        {stage === 'brief' && <div className="pc-swatch pc-swatch-empty" />}
      </div>
      {stage === 'reveal' && (
        <p className="pc-detail tabular-nums">Yours · Target · {hueDistance(pick, hue)}° Off</p>
      )}
      {stage === 'brief' && <StartButton onClick={() => setStage('show')} />}
      {stage === 'answer' && (
        <>
          <input
            type="range"
            min={0}
            max={359}
            value={pick}
            onChange={(e) => setPick(Number(e.target.value))}
            className="pc-hue"
            aria-label="Hue"
            aria-valuenow={pick}
            data-no-tab-swipe
          />
          <Button fullWidth size="lg" onClick={() => lockIn({ hue: pick })}>
            Lock In
          </Button>
        </>
      )}
    </>
  );
}

function DotRound({
  dot,
  exposure,
  stage,
  setStage,
  lockIn,
}: RoundProps & { dot: [number, number]; exposure: number }) {
  const [mark, setMark] = useState<[number, number] | null>(null);
  useShowFor(stage, exposure, setStage);
  const place = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (stage !== 'answer') return;
    if (e.type === 'pointermove' && !e.buttons) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const box = e.currentTarget.getBoundingClientRect();
    const clamp = (n: number) => Math.max(0, Math.min(1000, Math.round(n)));
    setMark([
      clamp(((e.clientX - box.left) / box.width) * 1000),
      clamp(((e.clientY - box.top) / box.height) * 1000),
    ]);
  };
  const pos = (p: [number, number]) => ({ left: `${p[0] / 10}%`, top: `${p[1] / 10}%` });
  return (
    <>
      <p className="pc-brief">
        {stage === 'answer'
          ? 'Tap Where the Dot Was'
          : 'Remember the dot, then tap where it appeared.'}
      </p>
      <div
        className={'pc-board' + (stage === 'answer' ? ' pc-board-live' : '')}
        onPointerDown={place}
        onPointerMove={place}
        data-testid="spot-board"
        data-no-tab-swipe
        role="button"
        tabIndex={stage === 'answer' ? 0 : -1}
        aria-label="Dot Position"
        onKeyDown={(e) => {
          if (stage !== 'answer') return;
          const step = e.shiftKey ? 1 : 10;
          const delta: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
          };
          if (delta[e.key]) {
            e.preventDefault();
            const [x, y] = mark ?? [500, 500];
            setMark([
              Math.max(0, Math.min(1000, x + delta[e.key][0])),
              Math.max(0, Math.min(1000, y + delta[e.key][1])),
            ]);
          }
        }}
      >
        {(stage === 'show' || stage === 'reveal') && <span className="pc-dot" style={pos(dot)} />}
        {mark && <span className="pc-mark" style={pos(mark)} />}
      </div>
      {stage === 'brief' && <StartButton onClick={() => setStage('show')} />}
      {stage === 'answer' && (
        <Button fullWidth size="lg" disabled={!mark} onClick={() => mark && lockIn({ dot: mark })}>
          Lock In
        </Button>
      )}
    </>
  );
}

function PatternRound({
  cells,
  count,
  exposure,
  stage,
  setStage,
  lockIn,
}: RoundProps & { cells: number[]; count: number; exposure: number }) {
  const [picked, setPicked] = useState<number[]>([]);
  useShowFor(stage, exposure, setStage);
  const target = useMemo(() => new Set(cells), [cells]);
  const toggle = (c: number) =>
    setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : p.length < count ? [...p, c] : p));
  return (
    <>
      <p className="pc-brief">
        {stage === 'answer'
          ? `Tap the ${count} Squares · ${picked.length} / ${count}`
          : `Remember the ${count} lit squares, then select them again.`}
      </p>
      <div
        className="pc-grid"
        role="group"
        aria-label="Pattern Grid"
        style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }}
      >
        {Array.from({ length: GRID * GRID }, (_, c) => {
          const lit = stage === 'show' && target.has(c);
          const on = picked.includes(c);
          const cls =
            stage === 'reveal'
              ? on && target.has(c)
                ? ' pc-cell-hit'
                : on
                  ? ' pc-cell-wrong'
                  : target.has(c)
                    ? ' pc-cell-missed'
                    : ''
              : lit || on
                ? ' pc-cell-on'
                : '';
          return (
            <button
              key={c}
              type="button"
              className={'pc-cell' + cls}
              disabled={stage !== 'answer'}
              aria-pressed={stage === 'answer' ? on : undefined}
              aria-label={`Square ${c + 1}`}
              onClick={() => toggle(c)}
            />
          );
        })}
      </div>
      {stage === 'brief' && <StartButton onClick={() => setStage('show')} />}
      {stage === 'answer' && (
        <Button
          fullWidth
          size="lg"
          disabled={picked.length !== count}
          onClick={() => lockIn({ cells: picked })}
        >
          Lock In
        </Button>
      )}
    </>
  );
}

function ReactionRound({ delay, stage, setStage, lockIn }: RoundProps & { delay: number }) {
  const [go, setGo] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const signalAt = useRef(0);
  useEffect(() => {
    if (stage !== 'answer') return;
    const t = window.setTimeout(() => {
      signalAt.current = now();
      setGo(true);
    }, delay);
    return () => window.clearTimeout(t);
  }, [stage, delay]);
  const tap = () => {
    if (stage !== 'answer') return;
    const ms = go ? Math.min(3000, Math.round(now() - signalAt.current)) : -1;
    setResult(ms);
    setGo(false);
    lockIn({ reactionMs: ms });
  };
  return (
    <>
      <p className="pc-brief">Wait for the red panel, then tap as quickly as you can.</p>
      {stage === 'brief' ? (
        <StartButton onClick={() => setStage('answer')} />
      ) : (
        <button
          type="button"
          className={'pc-react' + (go ? ' pc-react-go' : '')}
          data-no-tab-swipe
          disabled={stage === 'reveal'}
          onPointerDown={tap}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              if (!e.repeat) tap();
            }
          }}
        >
          {stage === 'reveal' ? (
            result === -1 ? (
              'Too Early'
            ) : (
              <span className="tabular-nums">{result} ms</span>
            )
          ) : go ? (
            'Tap'
          ) : (
            'Wait'
          )}
        </button>
      )}
    </>
  );
}
