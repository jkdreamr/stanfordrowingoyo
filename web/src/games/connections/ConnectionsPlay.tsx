import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GROUP_SIZE, MAX_MISTAKES } from '../../../../shared/games/connections';
import type { ConnectionsDay, ConnectionsRevealedGroup } from '../../../../shared/types';
import { api } from '../../lib/api';
import { qk } from '../../lib/queries';
import { Button } from '../../components/ui/Button';
import type { PlayProps } from '../DailyGameFrame';
import './connections.css';

export interface ConnectionsPayload {
  guesses: string[][];
}
interface Draft {
  guesses: string[][];
  order: string[];
}

const guessKey = (guess: readonly string[]) => [...guess].sort().join('\n');
/** Longest unbreakable run, so tiles shrink type instead of splitting a word. */
const fitLength = (word: string) => Math.max(6, ...word.split(' ').map((part) => part.length));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function shuffled(words: string[]) {
  const next = [...words];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function GroupBar({ group }: { group: ConnectionsRevealedGroup }) {
  return (
    <div className={`cx-bar cx-level-${group.level}`} role="listitem">
      <p className="cx-bar-name">{group.name}</p>
      <p className="cx-bar-words">{group.words.join(', ')}</p>
    </div>
  );
}

export function ConnectionsPlay({ date, onComplete }: PlayProps<ConnectionsPayload>) {
  const day = useQuery({
    queryKey: [...qk.root('games'), 'connections', date],
    queryFn: ({ signal }) => api('GET /api/games/connections/today', { signal }),
    staleTime: Infinity,
  });
  const words = day.data?.date === date ? day.data.words : null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [state, setState] = useState<ConnectionsDay | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    if (!day.data || draft) return;
    setDraft({ guesses: day.data.guesses, order: day.data.words });
    setState(day.data);
  }, [day.data, draft]);

  useEffect(() => {
    if (!state?.finished || !draft || finished.current) return;
    const t = window.setTimeout(
      () => {
        finished.current = true;
        onComplete({ guesses: draft.guesses });
      },
      reducedMotion() ? 600 : 2200,
    );
    return () => window.clearTimeout(t);
  }, [draft, onComplete, state]);

  const flag = useCallback((text: string, bump = true) => {
    setMessage(text);
    if (!bump) return;
    setShake(true);
    window.setTimeout(() => setShake(false), 400);
  }, []);

  if (!words || !draft)
    return (
      <div className="cx-loading" role="status">
        {day.isError ? (
          <Button variant="secondary" onClick={() => void day.refetch()}>
            Try Again
          </Button>
        ) : (
          <span className="cx-sr">Loading</span>
        )}
      </div>
    );

  const solved = state?.finished && state.groups ? state.groups : (state?.solved ?? []);
  const solvedWords = new Set(solved.flatMap((g) => g.words));
  const open = draft.order.filter((w) => !solvedWords.has(w));
  const mistakesLeft = MAX_MISTAKES - (state?.mistakes ?? 0);
  const done = Boolean(state?.finished);

  function toggle(word: string) {
    if (done || checking) return;
    setMessage('');
    setSelected((s) =>
      s.includes(word) ? s.filter((w) => w !== word) : s.length < GROUP_SIZE ? [...s, word] : s,
    );
  }

  async function submit() {
    if (!draft || selected.length !== GROUP_SIZE || done || checking) return;
    if (draft.guesses.some((g) => guessKey(g) === guessKey(selected)))
      return flag('Already Guessed');
    setChecking(true);
    try {
      const result = await api('POST /api/games/connections/guess', { body: { guess: selected } });
      setDraft({ ...draft, guesses: result.guesses });
      setState(result);
      if (result.outcome === 'correct') {
        setSelected([]);
        setMessage('');
      } else if (result.finished) {
        setSelected([]);
        setMessage('');
      } else flag(result.outcome === 'one_away' ? 'One Away' : '');
    } catch (error) {
      flag(error instanceof Error ? error.message : 'Could Not Check Guess', false);
      const resumed = await day.refetch();
      if (resumed.data) {
        setState(resumed.data);
        setDraft({ ...draft, guesses: resumed.data.guesses });
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="cx">
      <div className="cx-solved" role="list" aria-label="Solved Groups">
        {solved.map((g) => (
          <GroupBar key={g.level} group={g} />
        ))}
      </div>
      {open.length > 0 && (
        <div className={'cx-grid' + (shake ? ' cx-shake' : '')} role="group" aria-label="Words">
          {open.map((word) => (
            <button
              key={word}
              type="button"
              className="cx-tile"
              aria-pressed={selected.includes(word)}
              onClick={() => toggle(word)}
              disabled={done}
              style={{ '--cx-len': fitLength(word) } as CSSProperties}
            >
              <span>{word}</span>
            </button>
          ))}
        </div>
      )}
      <p className="cx-toast" role="status" aria-live="polite">
        {message}
      </p>
      {!done && (
        <>
          <div
            className="cx-mistakes"
            role="img"
            aria-label={`${mistakesLeft} ${mistakesLeft === 1 ? 'Mistake' : 'Mistakes'} Left`}
          >
            <span>Mistakes Left</span>
            {Array.from({ length: MAX_MISTAKES }, (_, i) => (
              <i key={i} className={i < mistakesLeft ? 'cx-dot' : 'cx-dot cx-dot-used'} />
            ))}
          </div>
          <div className="cx-actions">
            <Button
              variant="secondary"
              onClick={() => setDraft({ ...draft, order: shuffled(draft.order) })}
            >
              Shuffle
            </Button>
            <Button variant="secondary" onClick={() => setSelected([])} disabled={!selected.length}>
              Deselect All
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={selected.length !== GROUP_SIZE}
              loading={checking}
            >
              Submit
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
