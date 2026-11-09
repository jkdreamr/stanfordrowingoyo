import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import {
  formatHigherLowerValue,
  type HigherLowerChoice,
} from '../../../../shared/games/higherlower';
import type { HigherLowerDay, HigherLowerItem } from '../../../../shared/types';
import { api, ApiClientError } from '../../lib/api';
import { qk } from '../../lib/queries';
import { Button, useToast } from '../../components/ui';
import { LoadState } from '../../components/shell/LoadState';
import type { PlayProps } from '../DailyGameFrame';

export const titleCase = (text: string) =>
  text.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
interface Reveal {
  day: HigherLowerDay;
  item: HigherLowerItem;
  correct: boolean;
  value: number;
  settled: boolean;
}

function ItemCard({
  item,
  display,
  next,
  asOf,
  outcome,
}: {
  item: HigherLowerItem;
  display: string | null;
  next?: boolean;
  asOf: number | null;
  outcome?: boolean;
}) {
  return (
    <section
      className={`hl-card${outcome === true ? ' hl-correct' : outcome === false ? ' hl-miss' : ''}`}
      aria-label={next ? 'Next Item' : 'Current Item'}
    >
      <div className="hl-card-heading">
        <h3>{item.name}</h3>
        {outcome !== undefined &&
          (outcome ? <Check aria-label="Correct" size={20} /> : <X aria-label="Miss" size={20} />)}
      </div>
      <p className="hl-detail">
        <span>{item.detail || (next ? 'Your Next Comparison' : 'Current Item')}</span>
        {item.asOf !== undefined && item.asOf !== asOf && (
          <span className="hl-year">{item.asOf === null ? 'Timeless' : `As of ${item.asOf}`}</span>
        )}
      </p>
      <p
        className={`hl-value${display === null ? ' hl-hidden' : ''}`}
        aria-label={display ?? 'Value Hidden'}
      >
        {display === null ? (
          '?'
        ) : (
          <>
            <span>{display.split(' ')[0]}</span>
            {display.includes(' ') && (
              <span className="hl-unit">{display.slice(display.indexOf(' '))}</span>
            )}
          </>
        )}
      </p>
    </section>
  );
}

export function HigherLowerPlay({ date, onComplete }: PlayProps<Record<string, never>>) {
  const client = useQueryClient();
  const toast = useToast();
  const key = [...qk.root('games'), 'higherlower', date];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api('GET /api/games/higherlower/today', { signal }),
    staleTime: Infinity,
  });
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [pending, setPending] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const busy = useRef(false);
  const active = useRef(true);
  const completed = useRef(false);
  const frame = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const heading = useRef<HTMLHeadingElement>(null);
  const day = query.data;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      cancelAnimationFrame(frame.current);
      clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (day?.finished && !busy.current && !completed.current) {
      completed.current = true;
      onComplete({});
    }
  }, [day, onComplete]);

  async function guess(choice: HigherLowerChoice) {
    if (!day?.next || busy.current || day.finished) return;
    busy.current = true;
    setPending(true);
    try {
      const result = await api('POST /api/games/higherlower/guess', {
        body: { step: day.step, choice, date: day.date },
      });
      if (!active.current) return;
      const item = result.items.at(-1)!;
      const correct = result.results.at(-1)!;
      const advance = () => {
        if (!active.current) return;
        client.setQueryData(key, result);
        setReveal(null);
        setPending(false);
        busy.current = false;
        if (result.finished) {
          completed.current = true;
          onComplete({});
        } else {
          requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
          void client.invalidateQueries({ queryKey: qk.root('games') });
        }
      };
      const announce = () =>
        setAnnouncement(`${correct ? 'Correct' : 'Not Quite'}. ${item.name}, ${item.display}.`);
      if (reducedMotion()) {
        announce();
        advance();
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / 800);
        setReveal({
          day: result,
          item,
          correct,
          value: item.value! * (1 - (1 - progress) ** 3),
          settled: progress === 1,
        });
        if (progress < 1) frame.current = requestAnimationFrame(tick);
        else {
          announce();
          timer.current = setTimeout(advance, 450);
        }
      };
      frame.current = requestAnimationFrame(tick);
    } catch (error) {
      if (!active.current) return;
      busy.current = false;
      setPending(false);
      if (error instanceof ApiClientError && error.status === 409) {
        if (error.detail.code === 'DAY_CHANGED') {
          toast.show({ title: 'A New Day Is Ready' });
          void client.invalidateQueries({ queryKey: qk.root('config') });
        }
        await query.refetch();
        void client.invalidateQueries({ queryKey: qk.root('games') });
      } else toast.show({ title: 'Could Not Send Guess. Try Again.', tone: 'error' });
    }
  }
  if (!day || day.date !== date || !day.items.length)
    return <LoadState error={query.isError} retry={() => void query.refetch()} />;
  const current = day.items.at(-1)!;
  const next = reveal?.item ?? day.next;
  return (
    <div className="hl">
      <div className="hl-top">
        <h2 ref={heading} tabIndex={-1}>
          {day.question ?? 'Higher or Lower'}
        </h2>
        <div className="hl-meta">
          {day.asOfLabel && <p>{day.asOfLabel}</p>}
          <p>
            Streak <strong>{day.score}</strong> <span>of {day.rounds}</span>
          </p>
        </div>
      </div>
      <div className="hl-pair" aria-busy={pending}>
        <div key={current.name} className="hl-current">
          <ItemCard item={current} display={current.display} asOf={day.asOf} />
        </div>
        {next && (
          <ItemCard
            item={next}
            display={reveal && day.unit ? formatHigherLowerValue(reveal.value, day.unit) : null}
            next
            asOf={day.asOf}
            outcome={reveal?.settled ? reveal.correct : undefined}
          />
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {day.next && !day.finished && (
        <div className="hl-actions" role="group" aria-label="Your Guess">
          <Button
            disabled={pending}
            leading={<ChevronUp size={20} />}
            aria-label={`${titleCase(day.higherLabel!)} Than ${current.name}`}
            onClick={() => void guess('higher')}
          >
            {titleCase(day.higherLabel!)}
          </Button>
          <Button
            variant="secondary"
            disabled={pending}
            leading={<ChevronDown size={20} />}
            aria-label={`${titleCase(day.lowerLabel!)} Than ${current.name}`}
            onClick={() => void guess('lower')}
          >
            {titleCase(day.lowerLabel!)}
          </Button>
        </div>
      )}
    </div>
  );
}
