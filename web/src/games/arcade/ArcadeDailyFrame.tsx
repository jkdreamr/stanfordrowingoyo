import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Share } from 'lucide-react';
import type { ArcadeDay, ArcadeRunStart } from '../../../../shared/types';
import { api, ApiClientError } from '../../lib/api';
import { qk } from '../../lib/queries';
import { Button } from '../../components/ui';
import { LoadState } from '../../components/shell/LoadState';
import { GameLocked } from '../GameLocked';
import { GameDayBoard } from '../GameDayBoard';
import { useShareResult } from '../share';
import { ArcadeStage } from './kit/ArcadeStage';
import type { ArcadePlayProps, ArcadeRunResult } from './kit/types';

export interface ArcadeDailyFrameProps<S> {
  gameId: string;
  title: string;
  howTo: string[];
  formatScore(score: number): string;
  renderPlay(props: ArcadePlayProps<S>): ReactNode;
  summarizeStats?(stats: S): ReactNode;
}

export function ArcadeDailyFrame<S>({
  gameId,
  title,
  howTo,
  formatScore,
  renderPlay,
  summarizeStats,
}: ArcadeDailyFrameProps<S>) {
  const client = useQueryClient();
  const share = useShareResult();
  const key = [...qk.root('games'), 'arcade', gameId, 'today'];
  const day = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      api('GET /api/games/:game/today', { params: { game: gameId }, signal }),
    refetchOnMount: 'always',
  });
  const [active, setActive] = useState<ArcadeRunStart | null>(null);
  const [pending, setPending] = useState<ArcadeRunResult<S> | null>(null);
  const [over, setOver] = useState<{ result: ArcadeRunResult<S>; newBest: boolean } | null>(null);
  const [changed, setChanged] = useState(false);
  function update(value: ArcadeDay) {
    client.setQueryData(key, value);
    void client.invalidateQueries({ queryKey: qk.root('games') });
  }
  function conflict(error: unknown) {
    if (!(error instanceof ApiClientError) || error.status !== 409) return false;
    if (error.detail.code === 'DAY_CHANGED') setChanged(true);
    else {
      setActive(null);
      setPending(null);
      void day.refetch();
    }
    return true;
  }
  const start = useMutation({
    mutationFn: () =>
      api('POST /api/games/:game/runs/start', {
        params: { game: gameId },
        body: { date: day.data!.date },
      }),
    onSuccess: (value) => {
      setOver(null);
      setPending(null);
      setActive(value);
      update(value);
    },
    onError: conflict,
  });
  const finish = useMutation({
    mutationFn: async (result: ArcadeRunResult<S>) => {
      try {
        return await api('POST /api/games/:game/runs/finish', {
          params: { game: gameId },
          body: { date: active!.date, run: active!.run, score: result.score, stats: result.stats },
        });
      } catch (error) {
        if (
          error instanceof ApiClientError &&
          error.status === 409 &&
          error.detail.code === 'RUN_FINISHED'
        )
          return api('GET /api/games/:game/today', { params: { game: gameId } });
        throw error;
      }
    },
    onSuccess: (value, result) => {
      setOver({
        result,
        newBest:
          (active!.best === null || result.score > active!.best) && value.best === result.score,
      });
      setActive(null);
      setPending(null);
      update(value);
    },
    onError: conflict,
  });

  if (changed)
    return (
      <div className="space-y-4 text-center" role="alert">
        <h2 className="text-title2">A New Day Has Started</h2>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    );
  if (active && !pending)
    return (
      <ArcadeStage
        seed={active.seed}
        onGameOver={(result: ArcadeRunResult<S>) => {
          setPending(result);
          finish.mutate(result);
        }}
      >
        {renderPlay}
      </ArcadeStage>
    );
  if (pending)
    return finish.isError ? (
      <div className="space-y-4 text-center" role="alert">
        <h2 className="text-title2">Could Not Save Run</h2>
        <Button loading={finish.isPending} onClick={() => finish.mutate(pending)}>
          Try Again
        </Button>
      </div>
    ) : (
      <LoadState />
    );
  if (!day.data) return <LoadState error={day.isError} retry={() => void day.refetch()} />;
  if (!day.data.access.unlocked) return <GameLocked />;
  const value = day.data;
  const runsLeft = (
    <p className="text-subhead text-muted">
      Runs Left {value.attempts_left} of {value.runs_per_day}
    </p>
  );
  return (
    <div className="mx-auto max-w-[560px] space-y-8">
      {value.access.reason === 'no_oyo' && (
        <p className="text-subhead text-muted">No OYO on today's team schedule.</p>
      )}
      <section
        className="rounded-card border border-divider bg-surface p-4 space-y-4"
        aria-label={over ? 'Run Over' : 'Today’s Runs'}
      >
        {over ? (
          <>
            <h2 className="text-title2">{over.result.title}</h2>
            <p className="text-title1 tabular-nums">{formatScore(over.result.score)}</p>
            <p className="text-subhead text-muted">{over.result.detail}</p>
            {summarizeStats && (
              <div className="text-subhead text-muted">{summarizeStats(over.result.stats)}</div>
            )}
            {over.newBest && (
              <p className="text-headline" style={{ color: '#FC5200' }}>
                New Best
              </p>
            )}
            {runsLeft}
            <div className="flex flex-wrap gap-3">
              {value.attempts_left > 0 && (
                <Button loading={start.isPending} onClick={() => start.mutate()}>
                  Play Again
                </Button>
              )}
              <Button variant="secondary" onClick={() => setOver(null)}>
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-headline">How To Play</h2>
            <ul className="list-disc space-y-2 pl-5 text-subhead">
              {howTo.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="text-subhead text-muted">
              Everyone gets the same map today. Best of {value.runs_per_day} runs counts.
            </p>
            <p className="text-subhead text-muted">Leaving mid-run uses that run.</p>
            {runsLeft}
            {value.best !== null && (
              <p className="text-headline tabular-nums">Best Today {formatScore(value.best)}</p>
            )}
            {value.runs.length > 0 && (
              <ul className="space-y-2 text-subhead">
                {value.runs.map((run) => (
                  <li key={run.attempt}>
                    Run {run.attempt} ·{' '}
                    {run.status === 'finished' && run.score !== null
                      ? formatScore(run.score)
                      : 'Left Early'}
                  </li>
                ))}
              </ul>
            )}
            {value.attempts_left > 0 && (
              <Button loading={start.isPending} onClick={() => start.mutate()}>
                {value.runs.length ? `Play Run ${value.runs.length + 1}` : 'Play'}
              </Button>
            )}
          </>
        )}
        {start.isError &&
          !(start.error instanceof ApiClientError && start.error.status === 409) && (
            <p role="alert" className="text-subhead">
              Could Not Start Run. Try Again.
            </p>
          )}
      </section>
      {value.best !== null && (
        <>
          <Button
            variant="secondary"
            leading={<Share size={20} strokeWidth={1.75} />}
            onClick={() =>
              void share(
                title,
                `${title} · ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value.date + 'T12:00:00Z'))}\nBest ${formatScore(value.best!)} · ${value.runs.length} of ${value.runs_per_day} runs`,
              )
            }
          >
            Share
          </Button>
        </>
      )}
      {(value.best !== null || value.attempts_left === 0) && (
        <GameDayBoard gameId={gameId} date={value.date} />
      )}
    </div>
  );
}
