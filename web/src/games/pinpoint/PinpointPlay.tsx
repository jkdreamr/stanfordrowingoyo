import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import type { PinpointDay } from '../../../../shared/types';
import { api, ApiClientError } from '../../lib/api';
import { qk } from '../../lib/queries';
import { Button } from '../../components/ui';
import { LoadState } from '../../components/shell/LoadState';
import { GameLocked } from '../GameLocked';
import type { PlayProps } from '../DailyGameFrame';
import './pinpoint.css';

export type PinpointPayload = Pick<PinpointDay, 'guesses'>;

export function Clues({ clues, revealed = -1 }: { clues: string[]; revealed?: number }) {
  return (
    <ol className="pp-clues" aria-label="Clues">
      {Array.from({ length: 5 }, (_, index) => (
        <li className={'pp-clue' + (!clues[index] ? ' pp-unrevealed' : '')} key={index}>
          <span className="text-footnote text-muted">Clue {index + 1}</span>
          <span className={'text-headline' + (revealed === index ? ' pp-reveal' : '')}>
            {clues[index] ?? 'Not Revealed'}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Category({ category, won }: { category: string; won: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return (
    <div className={'pp-category' + (won ? ' pp-won' : '')} role="status">
      {won && <CheckCircle2 size={20} strokeWidth={1.75} aria-hidden="true" />}
      <h2 ref={heading} tabIndex={-1} className="text-headline">
        {category}
      </h2>
    </div>
  );
}

export function PinpointPlay({ date, onComplete }: PlayProps<PinpointPayload>) {
  const client = useQueryClient();
  const queryKey = [...qk.root('games'), 'pinpoint', date];
  const day = useQuery({
    queryKey,
    queryFn: ({ signal }) => api('GET /api/games/pinpoint/today', { signal }),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const state = day.data;
  const [guess, setGuess] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [changed, setChanged] = useState(false);
  const [revealed, setRevealed] = useState(-1);
  const [announcement, setAnnouncement] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  const completed = useRef(false);
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!state?.finished || state.date !== date || completed.current) return;
    completed.current = true;
    onComplete({ guesses: state.guesses });
  }, [state, date, onComplete]);

  function keepVisible() {
    requestAnimationFrame(() => {
      if (!input.current || document.activeElement !== input.current) return;
      const bounds = input.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const bottom = top + (viewport?.height ?? window.innerHeight);
      if (bounds.top < top + 80 || bounds.bottom > bottom - 96)
        input.current.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  }
  useEffect(() => {
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', keepVisible);
    return () => viewport?.removeEventListener('resize', keepVisible);
  }, []);

  async function submit(text: string) {
    if (sending.current || !state || state.finished || changed || locked) return;
    sending.current = true;
    setBusy(true);
    setError('');
    let focus = true;
    try {
      await client.cancelQueries({ queryKey });
      const next = await api('POST /api/games/pinpoint/guess', {
        body: { guess: text, date },
        retry: false,
      });
      if (next.date !== date) {
        setChanged(true);
        return;
      }
      client.setQueryData(queryKey, next);
      setGuess('');
      setRevealed(next.finished ? -1 : next.cluesUsed - 1);
      setAnnouncement(
        next.finished
          ? `${next.won ? 'Category Found' : 'Category Revealed'}: ${next.category}`
          : `Clue ${next.cluesUsed}: ${next.clues.at(-1)}`,
      );
      focus = !next.finished;
      void client.invalidateQueries({ queryKey: qk.root('games'), refetchType: 'none' });
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.status === 403) setLocked(true);
      else if (caught instanceof ApiClientError && caught.detail.code === 'DAY_CHANGED')
        setChanged(true);
      else {
        setError(caught instanceof Error ? caught.message : 'Could Not Save Guess. Try Again.');
        if (!(caught instanceof ApiClientError && caught.status === 400)) {
          const resumed = await day.refetch();
          if ((resumed.data?.guesses.length ?? 0) > state.guesses.length) setGuess('');
        }
      }
    } finally {
      sending.current = false;
      setBusy(false);
      if (focus) input.current?.focus({ preventScroll: true });
    }
  }

  if (
    locked ||
    (day.error instanceof ApiClientError && day.error.status === 403) ||
    state?.access.unlocked === false
  )
    return <GameLocked />;
  if (changed || (state && state.date !== date))
    return (
      <div className="pp">
        <p role="alert">A New Day Has Started. Reload to Play.</p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    );
  if (!state) return <LoadState error={day.isError} retry={() => void day.refetch()} />;
  const wrong = state.guesses.filter((item) => item.text && !item.correct);
  return (
    <div className={'pp' + (reduced ? ' pp-reduced-motion' : '')}>
      <p className="text-subhead text-muted">
        Find the category connecting all five clues. Fewer clues, higher score.
      </p>
      <Clues clues={state.clues} revealed={revealed} />
      <p className="pp-sr" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {state.finished ? (
        <Category category={state.category!} won={state.won} />
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (guess.trim()) void submit(guess);
          }}
          className="pp-form"
          aria-busy={busy}
        >
          <div className="ui-field">
            <label htmlFor="pinpoint-guess">Your Category</label>
            <input
              id="pinpoint-guess"
              ref={input}
              className="ui-input"
              value={guess}
              onChange={(event) => {
                setGuess(event.target.value);
                setError('');
              }}
              onFocus={keepVisible}
              readOnly={busy}
              maxLength={60}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'pinpoint-error' : undefined}
            />
            {error && (
              <p id="pinpoint-error" className="text-footnote text-accent-ink" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="pp-actions">
            <Button variant="secondary" disabled={busy} onClick={() => void submit('')}>
              {state.cluesUsed === 5 ? 'Skip' : 'Reveal Next Clue'}
            </Button>
            <Button type="submit" loading={busy} disabled={!guess.trim()}>
              Guess
            </Button>
          </div>
        </form>
      )}
      {wrong.length > 0 && (
        <section aria-label="Previous Guesses" className="pp-guesses">
          <h2 className="text-subhead text-muted">Previous Guesses</h2>
          <ul>
            {wrong.map((item, index) => (
              <li key={index} className="text-subhead">
                {item.text}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
