import { Share2, Check } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useWeeklyRecap } from '../lib/queries';
import { recapDate, recapShareText } from '../lib/recap';
import { formatEMeters, formatNumber, formatPercent } from '../lib/format';
import {
  Card,
  IconButton,
  ListGroup,
  ListRow,
  PageHeader,
  ProgressRing,
  useToast,
} from '../components/ui';
import { LoadState } from '../components/shell/LoadState';
import { ModalityIcon } from '../components/shell/ModalityIcon';

export default function Recap() {
  const [params] = useSearchParams();
  const query = useWeeklyRecap(params.get('week') ?? undefined),
    recap = query.data;
  const toast = useToast();
  const title = recap ? `Week of ${recapDate(recap.week_start)}` : 'Weekly Recap';
  function share() {
    if (!recap) return;
    const url = `${window.location.origin}/recap?week=${recap.week_start}`;
    if (navigator.share)
      void navigator.share({ title, text: recapShareText(recap), url }).catch(() => {});
    else
      void navigator.clipboard
        .writeText(url)
        .then(() => toast.show({ title: 'Link Copied' }))
        .catch(() => toast.show({ title: 'Could Not Copy Link', tone: 'error' }));
  }
  return (
    <>
      <PageHeader
        title={title}
        back
        trailing={
          recap && (
            <IconButton aria-label="Share" onClick={share}>
              <Share2 size={20} strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
          )
        }
      />
      <div className="screen-stack">
        {!recap ? (
          <LoadState error={query.isError} retry={() => void query.refetch()} />
        ) : (
          <>
            <Card>
              <div className="flex justify-center">
                <ProgressRing
                  value={recap.total_m}
                  max={recap.target_m}
                  size={168}
                  label="Weekly Target"
                >
                  <span className="text-large-title">{formatPercent(recap.percent)}</span>
                  <span className="text-caption text-muted">Of Target</span>
                </ProgressRing>
              </div>
              <p className="mt-5 text-center text-title2 tabular-nums">
                {formatEMeters(recap.total_m, true)} / {formatEMeters(recap.target_m, true)}{' '}
                <span className="text-footnote font-normal text-muted">E-meters</span>
              </p>
              <p
                className={`mt-2 flex items-center justify-center gap-1 text-subhead ${recap.hit_target ? 'target-hit' : 'text-muted'}`}
              >
                {recap.hit_target && <Check size={16} strokeWidth={1.75} aria-hidden="true" />}
                {recap.hit_target ? 'Target Hit' : 'Target Not Hit'}
              </p>
              <dl className="mt-6 grid grid-cols-2 divide-x divide-divider text-center">
                <div>
                  <dt className="text-footnote text-muted">Workouts</dt>
                  <dd className="mt-1 text-title2 tabular-nums">
                    {formatNumber(recap.entry_count)}
                  </dd>
                </div>
                <div>
                  <dt className="text-footnote text-muted">Streak</dt>
                  <dd
                    className={`mt-1 text-title2 tabular-nums ${recap.streak > 0 ? 'target-hit' : ''}`}
                  >
                    {formatNumber(recap.streak)}{' '}
                    <span className="text-footnote font-normal">
                      {recap.streak === 1 ? 'Week' : 'Weeks'}
                    </span>
                  </dd>
                </div>
              </dl>
            </Card>
            <section aria-label="By Modality">
              <h2 className="mb-3 text-headline">By Modality</h2>
              <ListGroup>
                {(['erg', 'bike', 'run'] as const).map((modality) => (
                  <ListRow
                    key={modality}
                    title={{ erg: 'Erg', bike: 'Bike', run: 'Run' }[modality]}
                    leading={<ModalityIcon modality={modality} />}
                    trailing={formatEMeters(recap.by_modality[modality])}
                  />
                ))}
              </ListGroup>
            </section>
            <section aria-label="Best Effort">
              <h2 className="mb-3 text-headline">Best Effort</h2>
              {recap.best_effort ? (
                <ListGroup>
                  <ListRow
                    title={recap.best_effort.title}
                    to={`/entries/${recap.best_effort.id}`}
                    leading={<ModalityIcon modality={recap.best_effort.modality} />}
                    trailing={formatEMeters(recap.best_effort.equiv_m)}
                  />
                </ListGroup>
              ) : (
                <p className="text-subhead text-muted">No Workouts</p>
              )}
            </section>
            <section aria-label="Team">
              <h2 className="mb-3 text-headline">Team</h2>
              <ListGroup>
                <ListRow title="E-meters" trailing={formatEMeters(recap.team.total_m)} />
                <ListRow title="Workouts" trailing={formatNumber(recap.team.entry_count)} />
                <ListRow
                  title="Rowers Hit Target"
                  trailing={`${formatNumber(recap.team.rowers_hit_target)} / ${formatNumber(recap.team.rowers)}`}
                />
                <ListRow
                  title="My Rank"
                  trailing={recap.rank === null ? '—' : `#${formatNumber(recap.rank)}`}
                />
              </ListGroup>
            </section>
          </>
        )}
      </div>
    </>
  );
}
