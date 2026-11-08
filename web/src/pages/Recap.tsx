import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Flame, Share2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { WeeklyRecap } from '../../../shared/types';
import { addDays, today, weekStart } from '../../../shared/dates';
import { useConfig, useMe, useWeeklyRecap } from '../lib/queries';
import {
  gameFacts,
  planPercent,
  raceOutcome,
  recapDate,
  recapRange,
  recapShareText,
} from '../lib/recap';
import { recapImage, shareRecapFile } from '../lib/recapImage';
import {
  formatCompactMeters,
  formatEMeters,
  formatMeters,
  formatNumber,
  formatPercent,
} from '../lib/format';
import {
  Button,
  IconButton,
  ListGroup,
  ListRow,
  PageHeader,
  ProgressRing,
  useToast,
} from '../components/ui';
import { Ticker } from '../components/ui/Ticker';
import { LoadState } from '../components/shell/LoadState';
import { ModalityIcon } from '../components/shell/ModalityIcon';

function Tile({
  label,
  detail,
  index,
  tone,
  children,
}: {
  label: string;
  detail?: string;
  index: number;
  tone?: 'win';
  children: ReactNode;
}) {
  return (
    <div className="ui-card recap-tile recap-reveal" style={{ '--i': index } as CSSProperties}>
      <dt className="text-footnote font-semibold text-muted">{label}</dt>
      <dd className={`recap-tile-value ${tone === 'win' ? 'text-accent-ink' : ''}`}>{children}</dd>
      {detail && <dd className="text-footnote text-muted">{detail}</dd>}
    </div>
  );
}

function Highlights({ recap }: { recap: WeeklyRecap }) {
  const key = `recap:${recap.week_start}`;
  const tiles: ReactNode[] = [];
  if (recap.rank !== null)
    tiles.push(
      <Tile
        key="rank"
        label="Team Rank"
        index={tiles.length}
        detail={`of ${formatNumber(recap.team.rowers)} ${recap.team.rowers === 1 ? 'Rower' : 'Rowers'}`}
      >
        <Ticker id={`${key}:rank`} value={recap.rank} format={(n) => `#${formatNumber(n)}`} />
      </Tile>,
    );
  if (recap.race) {
    const race = raceOutcome(recap.race);
    tiles.push(
      <Tile
        key="race"
        label="vs Berkeley"
        index={tiles.length}
        tone={race.leader === 'stanford' ? 'win' : undefined}
        detail={`${formatCompactMeters(recap.race.stanford_m)} to ${formatCompactMeters(recap.race.berkeley_m)}`}
      >
        {race.word}
      </Tile>,
    );
  }
  if (recap.plan)
    tiles.push(
      <Tile
        key="plan"
        label="My Fortnight"
        index={tiles.length}
        detail={`Week ${recap.plan.week} · ${formatMeters(recap.plan.logged_m, true)} of ${formatMeters(recap.plan.planned_m, true)}`}
      >
        {recap.plan.complete ? (
          <span className="inline-flex items-center gap-1 target-hit">
            <Check size={22} strokeWidth={2.5} aria-hidden="true" />
            Complete
          </span>
        ) : (
          <Ticker id={`${key}:plan`} value={planPercent(recap.plan)} format={formatPercent} />
        )}
      </Tile>,
    );
  if (recap.games.played > 0)
    tiles.push(
      <Tile
        key="games"
        label="Games Played"
        index={tiles.length}
        detail={gameFacts(recap.games).join(' · ') || undefined}
      >
        <Ticker id={`${key}:games`} value={recap.games.played} format={formatNumber} />
      </Tile>,
    );
  tiles.push(
    <Tile key="workouts" label="Workouts" index={tiles.length}>
      <Ticker id={`${key}:workouts`} value={recap.entry_count} format={formatNumber} />
    </Tile>,
  );
  if (tiles.length % 2) tiles.pop();
  return (
    <section aria-label="Highlights">
      <dl className="recap-grid">{tiles}</dl>
    </section>
  );
}

export default function Recap() {
  const [params, setParams] = useSearchParams();
  const config = useConfig().data;
  const me = useMe().data;
  const query = useWeeklyRecap(params.get('week') ?? undefined),
    recap = query.data;
  const toast = useToast();
  const [image, setImage] = useState<{ week: string; file: File | null }>();
  const name = me?.name ?? '';
  useEffect(() => {
    if (!recap || !name) return;
    let live = true;
    recapImage(recap, name)
      .then((file) => live && setImage({ week: recap.week_start, file }))
      .catch(() => live && setImage({ week: recap.week_start, file: null }));
    return () => {
      live = false;
    };
  }, [recap, name]);
  const title = recap ? `Week of ${recapDate(recap.week_start)}` : 'Weekly Recap';
  const week = recap?.week_start;
  const first = me ? weekStart(today(new Date(me.created_at))) : undefined;
  function go(date: string) {
    setParams({ week: date }, { replace: true });
  }
  function shareLink(data: WeeklyRecap) {
    const url = `${window.location.origin}/recap?week=${data.week_start}`;
    if (navigator.share)
      void navigator.share({ title, text: recapShareText(data), url }).catch(() => {});
    else
      void navigator.clipboard
        .writeText(url)
        .then(() => toast.show({ title: 'Link Copied' }))
        .catch(() => toast.show({ title: 'Could Not Copy Link', tone: 'error' }));
  }
  function share() {
    if (!recap) return;
    const file = image?.week === recap.week_start ? image.file : null;
    if (!file) return shareLink(recap);
    void shareRecapFile(file, { title, text: recapShareText(recap) }).then((result) => {
      if (result === 'downloaded') toast.show({ title: 'Image Saved' });
    });
  }
  return (
    <>
      <PageHeader title={title} back />
      <div className="screen-stack">
        {!recap ? (
          <LoadState error={query.isError} retry={() => void query.refetch()} />
        ) : (
          <>
            <nav aria-label="Recap Week" className="flex items-center justify-between gap-4">
              <IconButton
                aria-label="Previous Week"
                disabled={!!first && addDays(recap.week_start, -7) < first}
                onClick={() => go(addDays(recap.week_start, -7))}
              >
                <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
              </IconButton>
              <p className="text-headline tabular-nums" aria-live="polite">
                {recapRange(recap.week_start)}
              </p>
              <IconButton
                aria-label="Next Week"
                disabled={!config || addDays(recap.week_start, 7) >= config.current_week_start}
                onClick={() => go(addDays(recap.week_start, 7))}
              >
                <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
              </IconButton>
            </nav>
            <section aria-label="Weekly Target" className="drive-hero" key={week}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-subhead font-semibold drive-hero-soft">Weekly Target</span>
                {recap.streak > 0 && (
                  <span className="drive-chip drive-chip-streak">
                    <Flame size={14} strokeWidth={2} aria-hidden="true" />
                    {formatNumber(recap.streak)} Week Streak
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-display">
                    <Ticker
                      id={`recap:${recap.week_start}:total`}
                      value={recap.total_m}
                      duration={1200}
                      format={(n) => formatMeters(n, true)}
                    />
                  </p>
                  <p className="mt-2 text-subhead drive-hero-soft">
                    of {formatMeters(recap.target_m, true)} E-meters
                  </p>
                </div>
                <ProgressRing
                  size={104}
                  value={recap.total_m}
                  max={recap.target_m}
                  id={`recap:${recap.week_start}`}
                  label="Weekly Target"
                >
                  <span className="text-title3 tabular-nums">{formatPercent(recap.percent)}</span>
                </ProgressRing>
              </div>
              <div className="mt-4 text-footnote font-semibold">
                <span className="drive-chip">
                  {recap.hit_target && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}
                  {recap.hit_target ? 'Target Hit' : 'Target Not Hit'}
                </span>
              </div>
            </section>
            <Highlights recap={recap} />
            <Button
              variant="secondary"
              fullWidth
              leading={<Share2 size={20} strokeWidth={1.75} />}
              onClick={share}
            >
              Share Recap
            </Button>
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
