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
import { AnswerReveal } from './AnswerReveal';
import { DIVE_PROMPTS_PER_DAY } from '../../../../shared/games/dive';

function Session({
  day,
  userId,
  canModerate,
  refresh,
  busy,
}: {
  day: DiveDay;
  userId: string;
  canModerate: boolean;
  refresh: () => Promise<unknown>;
  busy: boolean;
}) {
  const index = day.answers.length;
  const key = deadlineKey(userId, day.date, index);
  const resumed = day.pending?.prompt_index === index;
  const [active, setActive] = useState(
    () => !day.complete && (resumed || savedDeadline(key) !== null),
  );
  const [reveal, setReveal] = useState<DiveAnswerResult | null>(() =>
    !day.complete && !resumed && !savedDeadline(key) ? (day.answers.at(-1) ?? null) : null,
  );
  const shown = reveal ? 'reveal' : day.complete ? 'results' : active ? 'prompt' : 'start';
  return (
    <div className={`space-y-6 ${shown === 'prompt' ? 'dive-session-playing' : ''}`}>
      {shown !== 'prompt' && (
        <div className="flex items-center justify-between gap-4 text-subhead text-muted">
          <p>{formatShortDate(day.date)}</p>
          {!day.complete && <p>{DIVE_PROMPTS_PER_DAY} Prompts · 25 Seconds</p>}
        </div>
      )}
      <div className={shown === 'results' ? 'space-y-6' : 'dive-layout'}>
        <div className="dive-scene">
          <WaterColumn
            key={shown === 'reveal' ? `reveal-${reveal?.prompt_index}` : 'total'}
            score={shown === 'reveal' && reveal ? reveal.points : day.score}
            compact={shown === 'prompt' || shown === 'reveal'}
            tier={shown === 'reveal' ? reveal?.tier : undefined}
          />
        </div>
        {shown === 'start' && (
          <section className="space-y-5 py-4">
            <h2 className="text-title1">Dive</h2>
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
            pending={resumed ? day.pending : null}
            onConflict={refresh}
            onSaved={(answer) => {
              setReveal(answer);
              setActive(false);
              void refresh();
            }}
          />
        )}
        {shown === 'reveal' && reveal && (
          <AnswerReveal
            answer={reveal}
            busy={busy}
            onContinue={() => {
              setReveal(null);
              setActive(true);
            }}
          />
        )}
        {shown === 'results' && <Results day={day} canModerate={canModerate} />}
      </div>
      {canModerate && !day.complete && shown !== 'prompt' && (
        <Results day={day} canModerate reviewOnly />
      )}
    </div>
  );
}
export default function Dive() {
  const client = useQueryClient();
  const access = useGameAccess();
  const me = useMe();
  const admin = me.data?.role === 'admin';
  const query = useQuery({
    queryKey: [...qk.root('games'), 'dive', access.data?.date, admin],
    queryFn: ({ signal }) =>
      admin
        ? api('GET /api/games/dive/days/:date', { params: { date: access.data!.date }, signal })
        : api('GET /api/games/dive/today', { signal }),
    enabled: !!access.data?.unlocked && !!me.data,
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
      canModerate={!!me.data && me.data.role !== 'rower' && (admin || query.data.complete)}
      busy={query.isFetching}
      refresh={() => client.invalidateQueries({ queryKey: qk.root('games') })}
    />
  );
}
