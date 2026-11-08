import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Share } from 'lucide-react';
import type { GameResult } from '../../../shared/types';
import { api, ApiClientError } from '../lib/api';
import { qk } from '../lib/queries';
import { Button } from '../components/ui';
import { useShareResult } from './share';
import { LoadState } from '../components/shell/LoadState';
import { useGameAccess } from './useGameAccess';
import { GameLocked } from './GameLocked';
import { GameDayBoard } from './GameDayBoard';

export interface PlayProps<P> {
  date: string;
  onComplete: (payload: P) => void;
}

export interface GameSummary {
  headline: ReactNode;
  detail?: ReactNode;
  /** Full-width content under the headline row. */
  body?: ReactNode;
  share: string;
}

export function DailyGameFrame<P>({
  gameId,
  title,
  play,
  summarize,
}: {
  gameId: string;
  title: string;
  play: (props: PlayProps<P>) => ReactNode;
  summarize: (result: GameResult) => GameSummary;
}) {
  const access = useGameAccess();
  const date = access.data?.date;
  const client = useQueryClient();
  const mineKey = [...qk.root('games'), 'me', gameId, date];
  const mine = useQuery({
    queryKey: mineKey,
    queryFn: ({ signal }) =>
      api('GET /api/games/:game/results/me', { params: { game: gameId }, query: { date }, signal }),
    enabled: Boolean(access.data?.unlocked),
  });
  const [pending, setPending] = useState<P | null>(null);
  const submit = useMutation({
    mutationFn: (payload: P) =>
      api('POST /api/games/:game/results', { params: { game: gameId }, body: { payload } }),
    onSuccess: (result) => {
      client.setQueryData(mineKey, result);
      void client.invalidateQueries({ queryKey: qk.root('games') });
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.status === 409) void mine.refetch();
    },
  });

  if (!access.data) return <LoadState error={access.isError} retry={() => void access.refetch()} />;
  if (!access.data.unlocked) return <GameLocked />;
  if (mine.data === undefined && !submit.data)
    return <LoadState error={mine.isError} retry={() => void mine.refetch()} />;
  const result = submit.data ?? mine.data;
  if (result) return <GameResultView title={title} result={result} summary={summarize(result)} />;
  if (pending !== null)
    return (
      <div className="mx-auto flex max-w-[420px] flex-col items-center gap-4 py-12 text-center">
        {submit.isError ? (
          <>
            <p className="text-headline">Could Not Save Result</p>
            <Button onClick={() => submit.mutate(pending)} loading={submit.isPending}>
              Try Again
            </Button>
          </>
        ) : (
          <LoadState />
        )}
      </div>
    );
  return play({
    date: access.data.date,
    onComplete: (payload) => {
      setPending(payload);
      submit.mutate(payload);
    },
  });
}

function GameResultView({
  title,
  result,
  summary,
}: {
  title: string;
  result: GameResult;
  summary: GameSummary;
}) {
  const shareResult = useShareResult();
  useEffect(() => window.scrollTo(0, 0), []);
  function share() {
    void shareResult(title, summary.share);
  }
  return (
    <div className="mx-auto max-w-[560px] space-y-8">
      <section
        className="rounded-card border border-divider bg-surface p-4"
        aria-label="Your Result"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-subhead text-muted">Today</p>
            <p className="text-title1 tabular-nums">{summary.headline}</p>
            {summary.detail && <div className="mt-1 text-subhead text-muted">{summary.detail}</div>}
          </div>
          <Button
            variant="secondary"
            onClick={share}
            leading={<Share size={20} strokeWidth={1.75} />}
          >
            Share
          </Button>
        </div>
        {summary.body}
      </section>
      <GameDayBoard gameId={result.game_id} date={result.date} />
    </div>
  );
}
