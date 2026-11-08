import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Delete } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { qk } from '../../lib/queries';
import { LoadState } from '../../components/shell/LoadState';
import { TRIES, WORD, type Mark } from '../../../../shared/games/wordGuess';
import type { PlayProps } from '../DailyGameFrame';
import './wordguess.css';

export interface WordGuessPayload {
  guesses: string[];
}

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const MARK_LABEL: Record<Mark, string> = {
  correct: 'correct',
  present: 'in the word',
  absent: 'not in the word',
};
export function WordGuessPlay({ date, onComplete }: PlayProps<WordGuessPayload>) {
  const client = useQueryClient();
  const queryKey = [...qk.root('games'), 'wordguess', date];
  const day = useQuery({
    queryKey,
    queryFn: ({ signal }) => api('GET /api/games/wordguess/today', { signal }),
  });
  const guesses = day.data?.guesses ?? [];
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [current, setCurrent] = useState('');
  const [message, setMessage] = useState('');
  const [shake, setShake] = useState(false);
  const [revealRow, setRevealRow] = useState(-1);
  const done = day.data?.done ?? false;

  useEffect(() => {
    if (!done) return;
    const delay =
      revealRow >= 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 1500 : 300;
    const t = window.setTimeout(
      () => onComplete({ guesses: guesses.map((row) => row.word) }),
      delay,
    );
    return () => window.clearTimeout(t);
  }, [done, guesses, onComplete, revealRow]);

  const reject = useCallback((text: string) => {
    setMessage(text);
    setShake(true);
    window.setTimeout(() => setShake(false), 400);
  }, []);

  const press = useCallback(
    (key: string) => {
      if (done || !day.data || sending.current) return;
      setMessage('');
      if (key === 'enter') {
        if (current.length < WORD) return reject('Not Enough Letters');
        sending.current = true;
        setBusy(true);
        void (async () => {
          try {
            await client.cancelQueries({ queryKey });
            const result = await api('POST /api/games/wordguess/guess', {
              body: { guess: current },
            });
            setRevealRow(guesses.length);
            client.setQueryData(queryKey, result);
            setCurrent('');
          } catch (error) {
            reject(error instanceof Error ? error.message : 'Could Not Save Guess');
            const refreshed = await day.refetch();
            if ((refreshed.data?.guesses.length ?? 0) > guesses.length) setCurrent('');
          } finally {
            sending.current = false;
            setBusy(false);
          }
        })();
      } else if (key === 'back') {
        setCurrent((c) => c.slice(0, -1));
      } else if (/^[a-z]$/.test(key)) {
        setCurrent((c) => (c.length < WORD ? c + key : c));
      }
    },
    [current, done, day, client, queryKey, guesses.length, reject],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const k = e.key.toLowerCase();
      if (k === 'enter') {
        if (target?.closest('button')) return;
        e.preventDefault();
        press('enter');
      } else if (k === 'backspace') {
        e.preventDefault();
        press('back');
      } else if (/^[a-z]$/.test(k)) press(k);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  const keys = useMemo(() => {
    const out: Record<string, Mark> = {};
    const rank = { absent: 0, present: 1, correct: 2 };
    for (const row of guesses)
      for (let i = 0; i < WORD; i++) {
        const old = out[row.word[i]],
          mark = row.marks[i];
        if (!old || rank[mark] > rank[old]) out[row.word[i]] = mark;
      }
    return out;
  }, [guesses]);
  const rows = Array.from({ length: TRIES }, (_, r) => {
    if (r < guesses.length) return guesses[r];
    if (r === guesses.length) return { word: current, marks: null };
    return { word: '', marks: null };
  });

  if (!day.data) return <LoadState error={day.isError} retry={() => void day.refetch()} />;
  return (
    <div className="wg">
      <div className="wg-board" role="grid" aria-label="Word Guess Board" aria-readonly="true">
        {rows.map((row, r) => (
          <div
            key={r}
            role="row"
            className={'wg-row' + (shake && r === guesses.length ? ' wg-shake' : '')}
            aria-label={
              row.marks ? `Guess ${r + 1}` : r === guesses.length ? 'Current Guess' : `Row ${r + 1}`
            }
          >
            {Array.from({ length: WORD }, (_, i) => {
              const letter = row.word[i] ?? '';
              const mark = row.marks?.[i];
              return (
                <div
                  key={i}
                  role="gridcell"
                  className={
                    'wg-tile' +
                    (mark ? ` wg-${mark}` : letter ? ' wg-filled' : '') +
                    (mark && r === revealRow ? ' wg-reveal' : '')
                  }
                  style={mark && r === revealRow ? { animationDelay: `${i * 180}ms` } : undefined}
                  aria-label={
                    letter
                      ? `${letter.toUpperCase()}${mark ? ', ' + MARK_LABEL[mark] : ''}`
                      : 'Empty'
                  }
                >
                  {letter.toUpperCase()}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="wg-message" role="status" aria-live="polite">
        {message}
      </p>
      <div className="wg-keyboard" aria-label="Keyboard">
        {ROWS.map((row, i) => (
          <div key={row} className="wg-key-row">
            {i === 2 && (
              <button
                type="button"
                className="wg-key wg-key-wide"
                onClick={() => press('enter')}
                disabled={done || busy}
              >
                Enter
              </button>
            )}
            {[...row].map((k) => (
              <button
                key={k}
                type="button"
                className={'wg-key' + (keys[k] ? ` wg-${keys[k]}` : '')}
                onClick={() => press(k)}
                disabled={done || busy}
                aria-label={
                  keys[k] ? `${k.toUpperCase()}, ${MARK_LABEL[keys[k]]}` : k.toUpperCase()
                }
              >
                {k.toUpperCase()}
              </button>
            ))}
            {i === 2 && (
              <button
                type="button"
                className="wg-key wg-key-wide"
                onClick={() => press('back')}
                disabled={done || busy}
                aria-label="Delete"
              >
                <Delete size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
