import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Delete } from 'lucide-react';
import {
  CHECK_PENALTY,
  MAX_SECONDS,
  REVEAL_PENALTY,
  formatCrosswordTime,
  type CrosswordDirection,
  type CrosswordResult,
  type CrosswordScope,
} from '../../../../shared/games/crossword';
import type { CrosswordDay } from '../../../../shared/types';
import { api, ApiClientError } from '../../lib/api';
import { qk } from '../../lib/queries';
import { Button, Sheet } from '../../components/ui';
import { LoadState } from '../../components/shell/LoadState';
import { GameLocked } from '../GameLocked';
import type { PlayProps } from '../DailyGameFrame';
import { CrosswordGrid } from './Grid';
import { activeSlot, nextClue, orderedSlots } from './navigation';
import './crossword.css';

type Action = 'start' | 'progress' | 'check' | 'reveal' | 'finish';
export function CrosswordPlay({ date, onComplete }: PlayProps<CrosswordResult>) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [...qk.root('games'), 'crossword', date],
    queryFn: ({ signal }) => api('GET /api/games/crossword/today', { signal }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const [state, setState] = useState<CrosswordDay | null>(null);
  const [cells, setCells] = useState<string[]>([]);
  const [selection, setSelection] = useState({ cell: 0, dir: 'across' as CrosswordDirection });
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState<{ kind: Action; scope?: CrosswordScope } | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<'check' | 'reveal' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const [penaltyNote, setPenaltyNote] = useState(0);
  const latest = useRef(cells),
    version = useRef(0),
    saved = useRef(0),
    queue = useRef<Promise<unknown>>(Promise.resolve()),
    offset = useRef(0),
    lastAttempt = useRef(''),
    complete = useRef(false),
    live = useRef(true);
  latest.current = cells;
  const current = useRef(state);
  current.current = state;
  const selected = useRef(selection);
  selected.current = selection;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  function accept(day: CrosswordDay, keepDraft = false) {
    offset.current = Date.parse(day.server_now) - Date.now();
    setState(
      keepDraft
        ? {
            ...day,
            cells: latest.current,
            wrong: day.wrong.filter((i) => latest.current[i] === day.cells[i]),
          }
        : day,
    );
    if (!keepDraft) {
      latest.current = day.cells;
      setCells(day.cells);
    }
  }
  useEffect(() => {
    if (!query.data || state) return;
    accept(query.data);
    setSelection({
      cell: query.data.cells.findIndex((_, i) => !query.data!.blocks.includes(i)),
      dir: 'across',
    });
  }, [query.data, state]);
  useEffect(() => {
    if (!state?.started || state.finished) return;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state?.started, state?.finished]);
  useEffect(() => {
    if (!penaltyNote) return;
    const timer = window.setTimeout(() => setPenaltyNote(0), 2200);
    return () => window.clearTimeout(timer);
  }, [penaltyNote]);
  useEffect(() => {
    if (!state?.finished || complete.current) return;
    const timer = window.setTimeout(
      () => {
        complete.current = true;
        onComplete({
          seconds: state.elapsed,
          penalty: state.penalty,
          checks: state.checks,
          reveals: state.reveals,
          solution: state.solution!,
        });
      },
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 650,
    );
    return () => window.clearTimeout(timer);
  }, [state, onComplete]);
  async function recover(error: unknown, retry?: { kind: Action; scope?: CrosswordScope }) {
    if (error instanceof ApiClientError && error.detail.code === 'DAY_CHANGED') {
      const next = await query.refetch();
      if (next.data) {
        version.current++;
        saved.current = version.current;
        accept(next.data);
      }
      void client.invalidateQueries({ queryKey: qk.root('games') });
    } else if (error instanceof ApiClientError && error.detail.code === 'ALREADY_PLAYED') {
      const next = await query.refetch();
      if (next.data) accept(next.data);
      void client.invalidateQueries({ queryKey: qk.root('games') });
    } else {
      setMessage(error instanceof Error ? error.message : 'Could Not Save. Try Again.');
      setRetry(retry ?? null);
    }
  }
  function send(action: Action, scope?: CrosswordScope, keepalive = false) {
    const task = queue.current
      .catch(() => {})
      .then(async () => {
        const day = current.current;
        if (!day || day.finished) return;
        const revision = version.current;
        const snapshot = [...latest.current];
        const body = { date: day.date, cells: snapshot };
        let result: CrosswordDay;
        if (action === 'start')
          result = await api('POST /api/games/crossword/start', { body: { date: day.date } });
        else if (action === 'check' || action === 'reveal')
          result = await api(
            action === 'check'
              ? 'POST /api/games/crossword/check'
              : 'POST /api/games/crossword/reveal',
            { body: { ...body, scope: scope!, ...selected.current } },
          );
        else if (keepalive) {
          const response = await fetch(`/api/games/crossword/${action}`, {
            method: 'POST',
            credentials: 'same-origin',
            keepalive: true,
            headers: { 'Content-Type': 'application/json', 'X-OYO-CSRF': '1' },
            body: JSON.stringify(body),
          });
          if (!response.ok) {
            const error = await response.json();
            throw new ApiClientError(response.status, error.error);
          }
          result = (await response.json()) as CrosswordDay;
        } else
          result = await api(
            action === 'finish'
              ? 'POST /api/games/crossword/finish'
              : 'POST /api/games/crossword/progress',
            { body },
          );
        saved.current = revision;
        if (action === 'finish') lastAttempt.current = snapshot.join('|');
        current.current = result;
        if (live.current) {
          setRetry(null);
          if (result.penalty > day.penalty) setPenaltyNote(result.penalty - day.penalty);
          accept(result, revision !== version.current && !result.finished);
          setMessage(
            action === 'finish' && result.incorrect && revision === version.current
              ? 'Not Quite — Keep Going'
              : '',
          );
          void client.invalidateQueries({ queryKey: qk.root('games'), refetchType: 'none' });
        }
      });
    queue.current = task;
    return task;
  }
  const sender = useRef(send);
  sender.current = send;
  function flush(keepalive = false) {
    const day = current.current;
    if (!day?.started || day.finished || version.current === saved.current) return;
    const full = latest.current.every((c, i) => day.blocks.includes(i) || !!c);
    const signature = latest.current.join('|');
    const action = full && signature !== lastAttempt.current ? 'finish' : 'progress';
    void sender
      .current(action, undefined, keepalive)
      .catch((error) => recover(error, { kind: action }));
  }
  const flusher = useRef(flush);
  flusher.current = flush;
  useEffect(() => {
    const timer = window.setTimeout(() => flusher.current(), 700);
    return () => window.clearTimeout(timer);
  }, [cells]);
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden') flusher.current(true);
    };
    const leave = () => flusher.current(true);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', leave);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', leave);
    };
  }, []);
  const slots = orderedSlots(state?.blocks ?? []);
  const word = activeSlot(slots, selection.cell, selection.dir);
  const clue = state?.clues.find((c) => c.dir === word?.dir && c.number === word?.number);
  function jump(step: number, unfilled = false, letters = latest.current) {
    if (word)
      setSelection(nextClue(slots, word, step, unfilled ? letters : undefined, state?.revealed));
  }
  function select(cell: number) {
    if (busy || state?.finished) return;
    setSelection({
      cell,
      dir:
        selection.cell === cell ? (selection.dir === 'across' ? 'down' : 'across') : selection.dir,
    });
  }
  function input(key: string) {
    if (!state?.started || state.finished || busy || menu || confirm || !word) return;
    const locked = state.revealed;
    const position = word.cells.indexOf(selection.cell);
    if (key === ' ') {
      setSelection({ ...selection, dir: selection.dir === 'across' ? 'down' : 'across' });
      return;
    }
    if (key === 'Tab' || key === 'ShiftTab') {
      jump(key === 'Tab' ? 1 : -1);
      return;
    }
    if (key.startsWith('Arrow')) {
      const dir = key === 'ArrowLeft' || key === 'ArrowRight' ? 'across' : 'down';
      if (dir !== selection.dir) {
        setSelection({ ...selection, dir });
        return;
      }
      const step = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
      let next = position + step;
      while (next >= 0 && next < word.cells.length && locked.includes(word.cells[next]))
        next += step;
      const cell = word.cells[next];
      if (cell !== undefined) setSelection({ ...selection, cell });
      return;
    }
    const letters = [...latest.current];
    let cell = selection.cell;
    if (key === 'Backspace') {
      if (!letters[cell] || locked.includes(cell)) {
        const previous = word.cells
          .slice(0, position)
          .reverse()
          .find((i) => !locked.includes(i));
        if (previous === undefined) return;
        cell = previous;
        setSelection({ ...selection, cell });
      }
      if (!locked.includes(cell)) letters[cell] = '';
    } else if (/^[a-z]$/i.test(key)) {
      if (locked.includes(cell)) return;
      letters[cell] = key.toUpperCase();
      const next = [...word.cells.slice(position + 1), ...word.cells.slice(0, position)].find(
        (i) => !letters[i] && !locked.includes(i),
      );
      if (next !== undefined) setSelection({ ...selection, cell: next });
      else jump(1, true, letters);
    } else return;
    version.current++;
    latest.current = letters;
    setCells(letters);
    setMessage('');
    setState({
      ...state,
      wrong: state.wrong.filter((i) => letters[i] === state.cells[i]),
      cells: letters,
    });
  }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !state?.started ||
        state.finished ||
        menu ||
        confirm
      )
        return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input,textarea,select,dialog')) return;
      if (event.key === 'Tab' && target?.closest('button,a') && !target.closest('.xw-grid')) return;
      if (
        /^[a-z]$/i.test(event.key) ||
        ['Backspace', 'Tab', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
          event.key,
        )
      ) {
        if (event.key === ' ' && target?.closest('button') && !target.closest('.xw-grid')) return;
        event.preventDefault();
        input(event.key === 'Tab' && event.shiftKey ? 'ShiftTab' : event.key);
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });
  async function action(kind: Action, scope?: CrosswordScope) {
    setBusy(true);
    setMenu(null);
    setConfirm(false);
    try {
      await send(kind, scope);
    } catch (error) {
      await recover(error, { kind, scope });
    } finally {
      setBusy(false);
    }
  }
  if (!state) return <LoadState error={query.isError} retry={() => void query.refetch()} />;
  if (!state.access.unlocked) return <GameLocked />;
  if (!state.available)
    return (
      <section className="xw xw-start">
        <h2>
          First Mini{' '}
          {state.available_from
            ? `Arrives ${new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${state.available_from}T12:00:00Z`))}`
            : 'Arrives Soon'}
        </h2>
        <p>A new daily crossword is on its way.</p>
      </section>
    );
  if (!state.started)
    return (
      <section className="xw xw-start">
        <h2>Ready to Solve?</h2>
        <p>A little crossword for your daily wind-down.</p>
        <p className="xw-muted">The timer starts when you open the grid.</p>
        <Button loading={busy} onClick={() => void action('start')}>
          Start
        </Button>
        <p role="status">{message}</p>
      </section>
    );
  const seconds = state.finished
    ? state.elapsed
    : Math.max(
        0,
        Math.min(
          MAX_SECONDS,
          Math.round((tick + offset.current - Date.parse(state.started_at!)) / 1000),
        ),
      );
  return (
    <section className={`xw${state.finished ? ' xw-finishing' : ''}`} aria-label="Crossword Game">
      <div className="xw-toolbar">
        <div className="xw-time" aria-label={`Solve Time ${formatCrosswordTime(seconds)}`}>
          <span>{formatCrosswordTime(seconds)}</span>
          {state.penalty > 0 && <span className="xw-muted">+{state.penalty}s</span>}
        </div>
        <div className="xw-tools">
          <Button
            size="sm"
            variant="plain"
            disabled={busy || state.finished}
            onClick={() => setMenu('check')}
          >
            Check
          </Button>
          <Button
            size="sm"
            variant="plain"
            disabled={busy || state.finished}
            onClick={() => setMenu('reveal')}
          >
            Reveal
          </Button>
        </div>
      </div>
      <div className="xw-layout">
        <CrosswordGrid
          cells={cells}
          blocks={state.blocks}
          active={selection.cell}
          dir={selection.dir}
          wrong={state.wrong}
          revealed={state.revealed}
          solved={state.finished}
          onSelect={select}
        />
        <div className="xw-clues">
          {(['across', 'down'] as const).map((dir) => (
            <section key={dir}>
              <h2>{dir === 'across' ? 'Across' : 'Down'}</h2>
              <ol>
                {state.clues
                  .filter((c) => c.dir === dir)
                  .map((c) => {
                    const slot = activeSlot(slots, selection.cell, dir);
                    return (
                      <li key={c.number}>
                        <button
                          className={
                            clue === c
                              ? 'xw-clue-active'
                              : slot?.number === c.number
                                ? 'xw-crossing'
                                : ''
                          }
                          onClick={() => setSelection({ cell: c.row * 5 + c.col, dir })}
                        >
                          <span>{c.number}</span>
                          {c.text}
                        </button>
                      </li>
                    );
                  })}
              </ol>
            </section>
          ))}
        </div>
      </div>
      <p className="xw-message" role="status">
        {state.finished ? 'Nicely Done' : message}
        {retry && (
          <Button
            size="sm"
            variant="plain"
            disabled={busy}
            onClick={() => void action(retry.kind, retry.scope)}
          >
            Retry
          </Button>
        )}
        {penaltyNote > 0 && (
          <span className="xw-penalty" key={state.penalty}>
            {' '}
            +{penaltyNote}s
          </span>
        )}
      </p>
      <p className="xw-sr" aria-live="polite" aria-atomic="true">
        {clue ? `${clue.number} ${clue.dir === 'across' ? 'Across' : 'Down'}, ${clue.text}` : ''}
      </p>
      <div className="xw-phone">
        <div className="xw-cluebar">
          <button aria-label="Previous Clue" onClick={() => jump(-1)}>
            <ChevronLeft size={20} />
          </button>
          <button
            className="xw-current-clue"
            aria-label="Toggle Clue Direction"
            onClick={() => input(' ')}
          >
            <strong>
              {clue?.number} {selection.dir === 'across' ? 'Across' : 'Down'}
            </strong>
            <span>{clue?.text}</span>
          </button>
          <button aria-label="Next Clue" onClick={() => jump(1)}>
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="xw-keyboard" aria-label="Crossword Keyboard">
          {['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row, index) => (
            <div className="xw-keyrow" key={row}>
              {[...row].map((letter) => (
                <button
                  key={letter}
                  aria-label={`Type ${letter}`}
                  disabled={busy || state.finished}
                  onClick={() => input(letter)}
                >
                  {letter}
                </button>
              ))}
              {index === 2 && (
                <button
                  className="xw-delete"
                  aria-label="Backspace"
                  disabled={busy || state.finished}
                  onClick={() => input('Backspace')}
                >
                  <Delete size={22} strokeWidth={1.75} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <Sheet
        open={!!menu}
        onClose={() => setMenu(null)}
        title={menu === 'reveal' ? 'Reveal Letters' : 'Check Letters'}
      >
        <div className="xw-menu">
          {(['cell', 'word', 'puzzle'] as const).map((scope) => (
            <Button
              variant="plain"
              key={scope}
              aria-label={`${scope === 'cell' ? 'Cell' : scope === 'word' ? 'Word' : 'Puzzle'} ${menu === 'check' ? `+${CHECK_PENALTY[scope]}s` : `+${REVEAL_PENALTY}s Per New Cell`}`}
              onClick={() => {
                if (menu === 'reveal' && scope === 'puzzle') {
                  setMenu(null);
                  setConfirm(true);
                } else void action(menu!, scope);
              }}
            >
              <span>{scope === 'cell' ? 'Cell' : scope === 'word' ? 'Word' : 'Puzzle'}</span>
              <span className="xw-muted">
                {menu === 'check'
                  ? `+${CHECK_PENALTY[scope]}s`
                  : `+${REVEAL_PENALTY}s Per New Cell`}
              </span>
            </Button>
          ))}
        </div>
      </Sheet>
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Reveal The Puzzle?"
        footer={
          <Button fullWidth onClick={() => void action('reveal', 'puzzle')}>
            Reveal Puzzle
          </Button>
        }
      >
        <p>Each Newly Revealed Cell Adds 15 Seconds. Correct Letters Stay Unchanged.</p>
      </Sheet>
    </section>
  );
}
