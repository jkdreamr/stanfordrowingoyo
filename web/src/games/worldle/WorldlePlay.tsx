import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '../../lib/api';
import { qk } from '../../lib/queries';
import { LoadState } from '../../components/shell/LoadState';
import type { WorldleDay } from '../../../../shared/types';
import type { PlayProps } from '../DailyGameFrame';
import { WorldleBoard } from './WorldleBoard';
import { CountryInput } from './CountryInput';
import './worldle.css';

export interface WorldlePayload {
  guesses: string[];
}
export const worldleKey = (date: string) => [...qk.root('games'), 'worldle', date];

function useWorldleDay(date: string) {
  return useQuery({
    queryKey: worldleKey(date),
    queryFn: ({ signal }) => api('GET /api/games/worldle/today', { signal }),
  });
}

export function CountryOutline({ shape }: { shape: string | null }) {
  if (!shape) return null;
  const url =
    import.meta.env.DEV && import.meta.env.VITE_MOCK === '1'
      ? '/mock-worldle.svg'
      : `/worldle/${shape}.svg`;
  return (
    <div className="worldle-shape-card">
      <div
        role="img"
        aria-label="Country outline"
        className="worldle-shape"
        style={{ maskImage: `url(${url})`, WebkitMaskImage: `url(${url})` }}
      />
    </div>
  );
}

export function WorldleReveal({ answer }: { answer: NonNullable<WorldleDay['answer']> }) {
  return (
    <section className="worldle-reveal" aria-label="Answer">
      <h2>{answer.name}</h2>
      <div className="worldle-map">
        <div className="worldle-map-land" aria-hidden="true" />
        <svg viewBox="0 0 360 180" role="img" aria-label={`Location of ${answer.name}`}>
          <circle cx={answer.lon + 180} cy={90 - answer.lat} r="4" className="worldle-map-marker" />
        </svg>
      </div>
    </section>
  );
}

export function WorldleResult({ date }: { date: string }) {
  const day = useWorldleDay(date);
  if (!day.data) return <LoadState error={day.isError} retry={() => void day.refetch()} />;
  return (
    <div className="worldle worldle-result">
      <CountryOutline shape={day.data.shape} />
      {day.data.answer && <WorldleReveal answer={day.data.answer} />}
      <WorldleBoard guesses={day.data.guesses} />
    </div>
  );
}

export function WorldlePlay({ date, onComplete }: PlayProps<WorldlePayload>) {
  const day = useWorldleDay(date);
  const client = useQueryClient();
  const sending = useRef(false);
  const completed = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const guesses = day.data?.guesses ?? [];

  useEffect(() => {
    if (!day.data?.done || completed.current) return;
    completed.current = true;
    onComplete({ guesses: day.data.guesses.map((row) => row.name) });
  }, [day.data, onComplete]);

  useEffect(() => {
    const viewport = window.visualViewport;
    function keepInputVisible() {
      const input = root.current?.querySelector('input');
      const inset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      root.current?.style.setProperty('--worldle-keyboard', `${inset}px`);
      if (!input || document.activeElement !== input) return;
      input.scrollIntoView?.({ block: 'center' });
    }
    viewport?.addEventListener('resize', keepInputVisible);
    return () => viewport?.removeEventListener('resize', keepInputVisible);
  }, []);

  async function submit(name: string) {
    if (sending.current || !day.data || day.data.done) return;
    sending.current = true;
    setBusy(true);
    setMessage('');
    const queryKey = worldleKey(date);
    try {
      await client.cancelQueries({ queryKey });
      const result = await api('POST /api/games/worldle/guess', { body: { guess: name, date } });
      client.setQueryData(queryKey, result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could Not Save Guess');
      if (error instanceof ApiClientError && error.detail.code === 'DAY_CHANGED') {
        void client.invalidateQueries({ queryKey: qk.root('games') });
        void client.invalidateQueries({ queryKey: qk.root('config') });
      } else await day.refetch();
      throw error;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  if (!day.data) return <LoadState error={day.isError} retry={() => void day.refetch()} />;
  return (
    <div className="worldle" ref={root}>
      <p className="worldle-instructions">One outline. Six guesses. Where in the world?</p>
      <CountryOutline shape={day.data.shape} />
      <WorldleBoard guesses={guesses} />
      <p className="worldle-message" role="status" aria-live="polite">
        {message}
      </p>
      {!day.data.done && (
        <CountryInput guessed={guesses.map((row) => row.name)} busy={busy} submit={submit} />
      )}
    </div>
  );
}
