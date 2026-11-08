import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Delete } from 'lucide-react';
import {
  TRIES,
  WORD,
  dailyAnswer,
  isAllowedWord,
  letterStates,
  score,
  unpack,
  type Mark,
} from '../../../../shared/games/wordGuess';
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
const draftKey = (date: string) => `oyo:games:wordguess:${date}`;

function loadDraft(date: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(draftKey(date)) ?? '[]');
    return Array.isArray(parsed)
      ? parsed
          .filter((g): g is string => typeof g === 'string' && /^[a-z]{5}$/.test(g))
          .slice(0, TRIES)
      : [];
  } catch {
    return [];
  }
}

export function WordGuessPlay({ date, onComplete }: PlayProps<WordGuessPayload>) {
  const answer = useMemo(() => dailyAnswer(date), [date]);
  const [guesses, setGuesses] = useState(() => loadDraft(date));
  const [current, setCurrent] = useState('');
  const [message, setMessage] = useState('');
  const [shake, setShake] = useState(false);
  const [revealRow, setRevealRow] = useState(-1);
  const [extra, setExtra] = useState<ReadonlySet<string> | null>(null);
  const done = guesses.length === TRIES || guesses.at(-1) === answer;
  const finished = useRef(false);

  useEffect(() => {
    let live = true;
    void import('../../../../shared/games/wordGuessGuesses').then((m) => {
      if (live) setExtra(new Set(unpack(m.GUESSES)));
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(date), JSON.stringify(guesses));
    } catch {
      /* storage full or blocked; progress stays in memory */
    }
  }, [date, guesses]);

  useEffect(() => {
    if (!done || finished.current) return;
    finished.current = true;
    const delay =
      revealRow >= 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 1500 : 300;
    const t = window.setTimeout(() => onComplete({ guesses }), delay);
    return () => window.clearTimeout(t);
  }, [done, guesses, onComplete, revealRow]);

  const reject = useCallback((text: string) => {
    setMessage(text);
    setShake(true);
    window.setTimeout(() => setShake(false), 400);
  }, []);

  const press = useCallback(
    (key: string) => {
      if (done) return;
      setMessage('');
      if (key === 'enter') {
        if (current.length < WORD) return reject('Not Enough Letters');
        if (!extra) return reject('Loading Words');
        if (!isAllowedWord(current, extra)) return reject('Not in Word List');
        setRevealRow(guesses.length);
        setGuesses((g) => [...g, current]);
        setCurrent('');
      } else if (key === 'back') {
        setCurrent((c) => c.slice(0, -1));
      } else if (/^[a-z]$/.test(key)) {
        setCurrent((c) => (c.length < WORD ? c + key : c));
      }
    },
    [current, done, extra, guesses.length, reject],
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

  const keys = useMemo(() => letterStates(guesses, answer), [guesses, answer]);
  const rows = Array.from({ length: TRIES }, (_, r) => {
    if (r < guesses.length) return { word: guesses[r], marks: score(guesses[r], answer) };
    if (r === guesses.length) return { word: current, marks: null };
    return { word: '', marks: null };
  });

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
                disabled={done}
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
                disabled={done}
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
                disabled={done}
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
