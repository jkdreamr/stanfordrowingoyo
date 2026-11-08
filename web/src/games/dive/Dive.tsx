import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DiveAnswerResult, DiveDay } from '../../../../shared/types';
import { Button } from '../../components/ui';
import { LoadState } from '../../components/shell/LoadState';
import { api } from '../../lib/api';
import { qk, useMe } from '../../lib/queries';
import { formatShortDate } from '../../lib/format';
import { useGameAccess } from '../useGameAccess';
import { GameLocked } from '../GameLocked';
import { WaterColumn } from './WaterColumn';
import { Prompt, deadlineKey, savedDeadline } from './Prompt';
import { Results } from './Results';

function Session({
  day,
  userId,
  staff,
  refresh,
  busy,
}: {
  day: DiveDay;
  userId: string;
  staff: boolean;
  refresh: () => Promise<unknown>;
  busy: boolean;
}) {
  const index = day.answers.length;
  const key = deadlineKey(userId, day.date, index);
  const [active, setActive] = useState(() => !day.complete && savedDeadline(key) !== null);
  const [reveal, setReveal] = useState<DiveAnswerResult | null>(() =>
    !day.complete && !savedDeadline(key) ? (day.answers.at(-1) ?? null) : null,
  );
  const shown = reveal ? 'reveal' : day.complete ? 'results' : active ? 'prompt' : 'start';
  return (
    <div className={`space-y-6 ${shown === 'prompt' ? 'dive-session-playing' : ''}`}>
      {shown !== 'prompt' && (
        <div className="flex items-center justify-between gap-4 text-subhead text-muted">
          <p>{formatShortDate(day.date)}</p>
          <p>{day.complete ? 'Live · Today' : '7 Prompts · 25 Seconds'}</p>
        </div>
      )}
      <div className={shown === 'results' ? 'space-y-6' : 'dive-layout'}>
        <div className="dive-scene">
          <WaterColumn score={day.score} compact={shown === 'prompt'} />
        </div>
        {shown === 'start' && (
          <section className="space-y-5 py-4">
            <h2 className="text-title1">Dive</h2>
            <p className="text-callout text-muted">Rarer answers go deeper.</p>
            <Button fullWidth onClick={() => setActive(true)}>
              Begin
            </Button>
          </section>
        )}
        {shown === 'prompt' && (
          <Prompt
            key={key}
            prompt={day.prompts[index]}
            index={index}
            storageKey={key}
            onConflict={refresh}
            onSaved={(answer) => {
              setReveal(answer);
              setActive(false);
              void refresh();
            }}
          />
        )}
        {shown === 'reveal' && reveal && (
          <section className="space-y-5 py-4" aria-label="Answer Result" aria-live="polite">
            <p className="text-subhead text-muted">{reveal.prompt_index + 1} of 7</p>
            <h2 className="text-title1">{reveal.tier}</h2>
            <p className="break-words text-title3">{reveal.answer || 'No Answer'}</p>
            <p className="text-title2 tabular-nums">+{reveal.points} m</p>
            {!reveal.hidden && reveal.count > 0 && (
              <p className="text-subhead text-muted">
                {Math.max(0, reveal.count - 1)} {reveal.count === 2 ? 'teammate' : 'teammates'}{' '}
                matched · {reveal.count} of {reveal.total} answers
              </p>
            )}
            <Button
              fullWidth
              disabled={busy}
              onClick={() => {
                setReveal(null);
                setActive(true);
              }}
            >
              Continue
            </Button>
          </section>
        )}
        {shown === 'results' && <Results day={day} staff={staff} />}
      </div>
      {staff && !day.complete && shown !== 'prompt' && (
        <details className="dive-staff-review">
          <summary className="py-4 text-headline">Team Answers</summary>
          <Results day={day} staff reviewOnly />
        </details>
      )}
    </div>
  );
}
export default function Dive() {
  const client = useQueryClient();
  const access = useGameAccess();
  const me = useMe();
  const query = useQuery({
    queryKey: [...qk.root('games'), 'dive', access.data?.date],
    queryFn: ({ signal }) => api('GET /api/games/dive/today', { signal }),
    enabled: !!access.data?.unlocked,
    refetchInterval: 30000,
  });
  if (!access.data) return <LoadState error={access.isError} retry={() => void access.refetch()} />;
  if (!access.data.unlocked) return <GameLocked />;
  if (!query.data) return <LoadState error={query.isError} retry={() => void query.refetch()} />;
  if (!query.data.access.unlocked) return <GameLocked />;
  return (
    <Session
      key={`${query.data.date}:${me.data?.id ?? 'me'}`}
      day={query.data}
      userId={me.data?.id ?? 'me'}
      staff={!!me.data && me.data.role !== 'rower'}
      busy={query.isFetching}
      refresh={() => client.invalidateQueries({ queryKey: qk.root('games') })}
    />
  );
}
