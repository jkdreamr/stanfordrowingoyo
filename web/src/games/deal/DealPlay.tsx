import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  applyDealOp,
  DEAL_ROUND_CAP_MS,
  formatDealTime,
  type DealCard,
  type DealOp,
  type DealStep,
} from '../../../../shared/games/deal';
import type { DealActive, DealDay, DealRoundResult } from '../../../../shared/types';
import { Button } from '../../components/ui';
import { LoadState } from '../../components/shell/LoadState';
import { api, ApiClientError } from '../../lib/api';
import { qk } from '../../lib/queries';
import type { PlayProps } from '../DailyGameFrame';
import './deal.css';

const OPS = [
  { op: '+', symbol: '+', name: 'Add', spoken: 'plus' },
  { op: '-', symbol: '−', name: 'Subtract', spoken: 'minus' },
  { op: '*', symbol: '×', name: 'Multiply', spoken: 'times' },
  { op: '/', symbol: '÷', name: 'Divide', spoken: 'divided by' },
] as const;
const SUITS = {
  S: ['♠', 'Spades'],
  H: ['♥', 'Hearts'],
  D: ['♦', 'Diamonds'],
  C: ['♣', 'Clubs'],
} as const;
const rank = (n: number) => ({ 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' })[n] ?? String(n);
const face = (n: number) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[n] ?? String(n);
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const parTime = (ms: number) => formatDealTime(ms).split('.')[0];
type LiveCard = { id: number; value: number; suit?: DealCard['suit']; slot: number };

export function DealPlay({ date, onComplete }: PlayProps<void>) {
  const client = useQueryClient();
  const [day, setDay] = useState<DealDay | null>(null),
    [recap, setRecap] = useState<number | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [changed, setChanged] = useState(false),
    [fresh, setFresh] = useState(false),
    [version, setVersion] = useState(0);
  const currentDay = useRef(day);
  currentDay.current = day;
  const sending = useRef(false),
    complete = useRef(onComplete);
  complete.current = onComplete;
  const apply = useCallback(
    (next: DealDay, showRecap?: number) => {
      if (next.date !== date) {
        setChanged(true);
        setError('A New Day Has Started. Reload to Play.');
        return;
      }
      setDay(next);
      setRecap(showRecap ?? null);
      setVersion((v) => v + 1);
      if (next.done && showRecap === undefined) complete.current();
    },
    [date],
  );
  const resume = useCallback(async () => {
    try {
      const next = await api('GET /api/games/deal/today', {});
      setFresh(false);
      const previous = currentDay.current;
      apply(next, previous?.active && next.round > previous.round ? previous.round : undefined);
      if (previous && next.round > previous.round)
        void client.invalidateQueries({ queryKey: qk.root('games'), refetchType: 'none' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could Not Load Round');
    }
  }, [apply, client]);
  useEffect(() => {
    void resume();
  }, [resume]);
  async function write(
    action: 'start' | 'answer' | 'skip',
    steps?: DealStep[],
    elapsedMs?: number,
  ) {
    if (sending.current || !day || changed) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const round = day.round;
      const next =
        action === 'answer'
          ? await api('POST /api/games/deal/answer', {
              body: { round, date, steps: steps!, elapsedMs: elapsedMs! },
              retry: false,
            })
          : action === 'start'
            ? await api('POST /api/games/deal/start', { body: { round, date }, retry: false })
            : await api('POST /api/games/deal/skip', { body: { round, date }, retry: false });
      setFresh(action === 'start');
      apply(next, action === 'start' ? undefined : round);
      void client.invalidateQueries({ queryKey: qk.root('games'), refetchType: 'none' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could Not Save Round');
      if (e instanceof ApiClientError && e.detail.code === 'DAY_CHANGED') setChanged(true);
      else await resume();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  if (!day)
    return changed ? (
      <section className="deal">
        <p role="alert">{error}</p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </section>
    ) : (
      <LoadState error={Boolean(error)} retry={() => void resume()} />
    );
  const index = recap ?? day.round;
  return (
    <section className="deal" aria-label="Deal" aria-busy={busy}>
      {error && (
        <p role="alert" className="deal-error">
          {error}
        </p>
      )}
      {changed ? (
        <Button onClick={() => window.location.reload()}>Reload</Button>
      ) : (
        <>
          <ol className="deal-progress" aria-label={`Round ${Math.min(index + 1, 5)} of 5`}>
            {day.counts.map((_, i) => (
              <li
                key={i}
                className={i < day.round ? 'deal-dot-done' : i === index ? 'deal-dot-current' : ''}
              />
            ))}
          </ol>
          {recap !== null ? (
            <DealRecap
              key={recap}
              result={day.results[recap]}
              onNext={() => {
                if (day.done) complete.current();
                else setRecap(null);
              }}
            />
          ) : day.active ? (
            <DealBoard
              key={`${day.active.round}:${version}`}
              active={day.active}
              fresh={fresh}
              busy={busy}
              onSolve={(steps, ms) => void write('answer', steps, ms)}
              onSkip={() => void write('skip')}
              onCap={() => void resume()}
            />
          ) : day.done ? null : (
            <div className="deal-intro">
              <h2 className="text-title2">Round {day.round + 1} of 5</h2>
              <p className="text-subhead text-muted">{day.counts[day.round]} Cards. One Goal.</p>
              <div className="deal-backs" aria-label={`${day.counts[day.round]} Face-Down Cards`}>
                {Array.from({ length: day.counts[day.round] }, (_, i) => (
                  <span key={i} className="deal-back" aria-hidden="true" />
                ))}
              </div>
              {day.round === 0 && (
                <div className="deal-how">
                  <p>Combine two cards with + − × ÷ to make a new card.</p>
                  <p>Use every card to hit the goal.</p>
                  <p>Whole numbers above zero only; division must be exact.</p>
                  <p className="text-muted">Skip adds 1:00. Lower total time wins.</p>
                </div>
              )}
              <Button fullWidth size="lg" loading={busy} onClick={() => void write('start')}>
                Deal Cards
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function DealBoard({
  active,
  fresh,
  busy,
  onSolve,
  onSkip,
  onCap,
}: {
  active: DealActive;
  fresh: boolean;
  busy: boolean;
  onSolve: (steps: DealStep[], elapsed: number) => void;
  onSkip: () => void;
  onCap: () => void;
}) {
  const initial = () => active.cards.map((c, id) => ({ ...c, id, slot: id }));
  const [cards, setCards] = useState<LiveCard[]>(initial),
    [steps, setSteps] = useState<DealStep[]>([]),
    [history, setHistory] = useState<LiveCard[][]>([]);
  const [selected, setSelected] = useState<number | null>(null),
    [op, setOp] = useState<DealOp | null>(null),
    [message, setMessage] = useState('');
  const [shake, setShake] = useState<number | null>(null),
    [confirm, setConfirm] = useState(false),
    [ready, setReady] = useState(!fresh || reduced()),
    [solved, setSolved] = useState(false),
    [merging, setMerging] = useState<{ a: number; b: number; dx: number; dy: number } | null>(null);
  const [time, setTime] = useState(fresh ? 0 : active.elapsedMs);
  const timer = useRef({ start: performance.now(), base: fresh ? 0 : active.elapsedMs }),
    skipTimer = useRef<ReturnType<typeof setTimeout>>(),
    animationTimer = useRef<ReturnType<typeof setTimeout>>(),
    errorTimer = useRef<ReturnType<typeof setTimeout>>();
  const buttons = useRef(new Map<number, HTMLButtonElement>()),
    capped = useRef(false),
    submission = useRef(false);
  const focusCard = useRef<number | null>(null);
  useEffect(() => {
    if (focusCard.current !== null) {
      buttons.current.get(focusCard.current)?.focus({ preventScroll: true });
      focusCard.current = null;
    }
  }, [cards]);
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(
      () => {
        timer.current = { start: performance.now(), base: 0 };
        setReady(true);
      },
      360 + (active.cards.length - 1) * 60,
    );
    return () => clearTimeout(t);
  }, [ready, active.cards.length]);
  useEffect(() => {
    if (!ready || solved) return;
    let frame: number;
    const tick = () => {
      const ms = Math.min(
        DEAL_ROUND_CAP_MS,
        timer.current.base + performance.now() - timer.current.start,
      );
      setTime((previous) => (Math.floor(previous / 100) === Math.floor(ms / 100) ? previous : ms));
      if (ms >= DEAL_ROUND_CAP_MS && !capped.current) {
        capped.current = true;
        onCap();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, solved, onCap]);
  useEffect(
    () => () => {
      clearTimeout(skipTimer.current);
      clearTimeout(animationTimer.current);
      clearTimeout(errorTimer.current);
    },
    [],
  );
  const elapsed = () => timer.current.base + performance.now() - timer.current.start;
  function announceError(text: string, id: number) {
    setMessage(text);
    setShake(id);
    clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => {
      setShake(null);
      setMessage('');
    }, 2400);
  }
  function commit(
    a: LiveCard,
    b: LiveCard,
    result: number,
    nextSteps: DealStep[],
    counted: number,
  ) {
    const id = active.cards.length + steps.length;
    const next = cards
      .filter((c) => c.id !== a.id)
      .map((c) => (c.id === b.id ? { id, value: result, slot: b.slot } : c));
    focusCard.current = id;
    setHistory([...history, cards]);
    setCards(next);
    setSteps(nextSteps);
    setSelected(null);
    setOp(null);
    setMerging(null);
    setMessage(`${a.value} ${OPS.find((o) => o.op === op)!.spoken} ${b.value} equals ${result}`);
    if (next.length === 1) {
      if (result === active.goal) {
        submission.current = true;
        setSolved(true);
        setTime(counted);
        setMessage(`Solved in ${formatDealTime(counted)}`);
        navigator.vibrate?.(20);
        animationTimer.current = setTimeout(() => onSolve(nextSteps, counted), reduced() ? 0 : 600);
      } else announceError('Not the Goal, Undo to Try Again', id);
    }
  }
  function choose(card: LiveCard) {
    if (busy || !ready || solved || merging || submission.current) return;
    setConfirm(false);
    if (selected === card.id) {
      setSelected(null);
      setOp(null);
      return;
    }
    if (selected === null || !op) {
      setSelected(card.id);
      setMessage('');
      return;
    }
    const a = cards.find((c) => c.id === selected)!;
    const result = applyDealOp(a.value, op, card.value);
    if (result === null) {
      announceError(
        op === '/' ? 'Must Divide Evenly' : 'Must Be a Whole Number Above Zero',
        card.id,
      );
      return;
    }
    const nextSteps = [...steps, { a: a.id, op, b: card.id }],
      counted = elapsed();
    if (reduced()) {
      commit(a, card, result, nextSteps, counted);
      return;
    }
    const from = buttons.current.get(a.id)!.getBoundingClientRect(),
      to = buttons.current.get(card.id)!.getBoundingClientRect();
    setMerging({ a: a.id, b: card.id, dx: to.left - from.left, dy: to.top - from.top });
    animationTimer.current = setTimeout(() => commit(a, card, result, nextSteps, counted), 180);
  }
  function undo() {
    if (!history.length) return;
    setCards(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    setSteps(steps.slice(0, -1));
    setSelected(null);
    setOp(null);
    setMessage('Move Undone');
    setShake(null);
  }
  function reset() {
    setCards(initial());
    setSteps([]);
    setHistory([]);
    setSelected(null);
    setOp(null);
    setMessage('Cards Reset');
    setShake(null);
    setConfirm(false);
  }
  function skip() {
    if (confirm) {
      clearTimeout(skipTimer.current);
      onSkip();
      return;
    }
    setConfirm(true);
    skipTimer.current = setTimeout(() => setConfirm(false), 3000);
  }
  const locked = busy || !ready || solved || Boolean(merging);
  return (
    <div className={`deal-board ${fresh ? 'deal-fresh' : 'deal-resume'}`} data-ready={ready}>
      <div className="deal-head">
        <h2 className="text-headline">Round {active.round + 1} of 5</h2>
        <div className="deal-clock">
          <span role="timer" aria-live="off" aria-label="Round Time">
            {formatDealTime(time)}
          </span>
          <span className="text-muted">Par {parTime(active.parMs)}</span>
        </div>
      </div>
      <div className="deal-goal">
        <span>Goal</span>
        <strong>{active.goal}</strong>
      </div>
      <div className="deal-cards" aria-label="Playing Cards">
        {cards.map((c, i) => (
          <button
            key={c.id}
            ref={(node) => {
              if (node) buttons.current.set(c.id, node);
              else buttons.current.delete(c.id);
            }}
            className={`deal-card ${c.suit ? '' : 'deal-merged'} ${c.suit === 'H' || c.suit === 'D' ? 'deal-red' : ''} ${selected === c.id ? 'deal-selected' : ''} ${shake === c.id ? 'deal-shake' : ''} ${solved ? 'deal-solved' : ''} ${merging?.a === c.id ? 'deal-moving' : ''} ${c.id >= active.cards.length ? 'deal-pop' : ''}`}
            disabled={locked}
            aria-pressed={selected === c.id}
            aria-label={
              c.suit ? `${rank(c.value)} of ${SUITS[c.suit][1]}, ${c.value}` : `Card, ${c.value}`
            }
            style={
              {
                '--deal-delay': `${i * 60}ms`,
                '--deal-x': `${merging?.dx ?? 0}px`,
                '--deal-y': `${merging?.dy ?? 0}px`,
                gridColumn: (c.slot % 4) + 1,
                gridRow: Math.floor(c.slot / 4) + 1,
              } as CSSProperties
            }
            onClick={() => choose(c)}
          >
            <span className="deal-face" aria-hidden="true">
              {c.suit && (
                <span className="deal-corner">
                  {face(c.value)}
                  <span>{SUITS[c.suit][0]}</span>
                </span>
              )}
              <span className="deal-number">{c.value}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="deal-operators" aria-label="Operators">
        {OPS.map((o) => (
          <Button
            key={o.op}
            variant="secondary"
            aria-label={o.name}
            aria-pressed={op === o.op}
            disabled={locked || selected === null}
            onClick={() => setOp(op === o.op ? null : o.op)}
          >
            {o.symbol}
          </Button>
        ))}
      </div>
      <p
        className={`deal-message ${shake !== null ? 'deal-error' : ''}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {message ||
          (!ready
            ? 'Dealing Cards…'
            : selected === null
              ? 'Choose a Card'
              : !op
                ? 'Choose an Operator'
                : 'Choose Another Card')}
      </p>
      <div className="deal-actions">
        <Button variant="secondary" disabled={locked || !history.length} onClick={undo}>
          Undo
        </Button>
        <Button variant="secondary" disabled={locked || !steps.length} onClick={reset}>
          Reset
        </Button>
        <Button variant="plain" disabled={locked} onClick={skip}>
          {confirm ? 'Tap Again to Skip' : 'Skip (+1:00)'}
        </Button>
      </div>
    </div>
  );
}

export function DealRecap({ result, onNext }: { result: DealRoundResult; onNext: () => void }) {
  const [shown, setShown] = useState(reduced() ? result.solution.length : 0);
  useEffect(() => {
    if (reduced()) return;
    const t = setInterval(() => setShown((n) => Math.min(n + 1, result.solution.length)), 500);
    return () => clearInterval(t);
  }, [result.solution.length]);
  const values = new Map(result.cards.map((c, i) => [i, c.value]));
  const lines = result.solution.map((step, i) => {
    const a = values.get(step.a)!,
      b = values.get(step.b)!,
      value = applyDealOp(a, step.op, b)!;
    values.set(result.cards.length + i, value);
    return `${a} ${OPS.find((o) => o.op === step.op)!.symbol} ${b} = ${value}`;
  });
  return (
    <div className="deal-recap">
      <h2 className="text-headline">Round {result.round + 1} Complete</h2>
      <div className="deal-recap-time">
        {result.skipped ? 'Skipped +1:00' : formatDealTime(result.timeMs)}
      </div>
      <p className="text-subhead text-muted">
        {result.skipped ? `Counted ${formatDealTime(result.timeMs)} · ` : ''}Par{' '}
        {parTime(result.parMs)}
      </p>
      <p className="deal-team">
        {!result.teamBest
          ? 'No One Has Solved It Yet'
          : result.teamBest.me
            ? 'You Set the Team Best'
            : `Team Best ${formatDealTime(result.teamBest.timeMs)} · ${result.teamBest.name}`}
      </p>
      <div className="deal-solution">
        <h3 className="text-subhead">One Way to {result.goal}</h3>
        <ol aria-label="Solution">
          {lines.map((line, i) => (
            <li key={i} style={{ visibility: i < shown ? 'visible' : 'hidden' }}>
              {line}
            </li>
          ))}
        </ol>
      </div>
      <Button fullWidth size="lg" onClick={onNext}>
        {result.round === 4 ? 'See Results' : 'Next Round'}
      </Button>
    </div>
  );
}
