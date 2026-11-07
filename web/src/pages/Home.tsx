import { Activity } from 'lucide-react';
import { useAnnouncements, useConfig, useWeekStats, useTarget, useMe } from '../lib/queries';
import {
  formatEMeters,
  formatEntryDate,
  formatKm,
  formatNumber,
  formatPercent,
  formatWeekday,
} from '../lib/format';
import { daysLeft, finishWeek } from '../lib/week';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { clearTargetFinish, pendingTargetFinish } from '../lib/targetFinish';
import {
  ActionCard,
  Button,
  Card,
  EmptyState,
  ListGroup,
  ListRow,
  PageHeader,
  ProgressRing,
  ZoneChip,
} from '../components/ui';
import { HeaderActions } from '../components/shell/HeaderActions';
import { LoadState } from '../components/shell/LoadState';
import { ModalityIcon } from '../components/shell/ModalityIcon';
import { TodaysPlan } from '../components/plan/TodaysPlan';
export default function Page() {
  const { data: user } = useMe();
  const { data: target } = useTarget();
  const configQuery = useConfig();
  const weekQuery = useWeekStats();
  const { data: announcements = [] } = useAnnouncements();
  const pinned = announcements.filter((a) => a.pinned);
  const config = configQuery.data;
  const week = weekQuery.data;
  const pending = user && week ? pendingTargetFinish(user.id, week.week_start) : undefined;
  const finishKey = `${user?.id}:${week?.week_start}`;
  const [heldFinish, setHeldFinish] = useState<{ key: string; value: typeof pending }>();
  const finish = heldFinish?.key === finishKey ? heldFinish.value : pending;
  useEffect(() => {
    if (pending && user && week) {
      setHeldFinish({ key: finishKey, value: pending });
      clearTargetFinish(user.id, week.week_start);
    }
  }, [pending, user, week, finishKey]);
  if (!config || !week)
    return (
      <>
        <PageHeader title="This Week" trailing={<HeaderActions settings />} />
        <LoadState
          error={configQuery.isError || weekQuery.isError}
          retry={() => {
            void configQuery.refetch();
            void weekQuery.refetch();
          }}
        />
      </>
    );
  const remaining = Math.max(0, week.target_m - week.total_m);
  const days = daysLeft(config.today, config.current_week_start);
  const recent = week.entries.map((e) => e.preset_id).filter(Boolean);
  const presets = config.presets
    .filter((p) => p.active)
    .sort(
      (a, b) =>
        Number(recent.includes(b.id)) - Number(recent.includes(a.id)) ||
        Number(b.zone === 'E') - Number(a.zone === 'E') ||
        Number(b.distance_m !== null) - Number(a.distance_m !== null) ||
        a.sort - b.sort,
    );
  const quick = [
    ...new Map(
      ['erg', 'bike', 'run']
        .flatMap((m) => presets.filter((p) => p.modality === m).slice(0, 2))
        .map((p) => [p.id, p]),
    ).values(),
  ];
  return (
    <>
      <PageHeader title="This Week" trailing={<HeaderActions settings />} />
      <div className="screen-stack">
        <ActionCard to="/me/target" label="Weekly Progress. Change Your Target">
          <div className="flex justify-center">
            <ProgressRing
              size={168}
              value={week.total_m}
              previousValue={finish?.target === week.target_m ? finish.previous : undefined}
              max={week.target_m}
              label="Weekly Target"
            >
              <span className="text-large-title">{formatPercent(week.percent)}</span>
              <span className="text-caption text-muted">of target</span>
            </ProgressRing>
          </div>
          <p className="mt-5 text-center text-title3 tabular-nums">
            {formatEMeters(week.total_m, true)} / {formatEMeters(week.target_m, true)}{' '}
            <span className="text-footnote font-normal text-muted">E-meters</span>
          </p>
          <p className="mt-2 text-center text-subhead text-muted">
            {week.hit_target ? (
              <span className="target-hit inline-flex items-center gap-1">
                <Check
                  size={16}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className={finish ? 'ui-finish-tick' : ''}
                />
                Target hit
              </span>
            ) : (
              `${formatEMeters(remaining)} remaining`
            )}{' '}
            · {days === 1 ? 'Last day' : `${formatNumber(days)} days left`}
          </p>
          {finish && (
            <span role="status" className="sr-only">
              Weekly target hit
            </span>
          )}
          <p className="mt-2 text-center text-caption text-muted">
            {target?.source === 'personal' ? 'Personal Target' : 'Group Default'}
          </p>
        </ActionCard>
        <TodaysPlan today={config.today} />
        {!week.hit_target && (
          <Card>
            <h2 className="text-headline">How to Finish Your Week</h2>
            <p className="mt-2 text-footnote text-muted">Choose one, or mix your sessions</p>
            <div className="mt-3">
              {finishWeek(week.total_m, week.target_m, config).map((s) => (
                <div key={s.modality} className="finish-row">
                  <ModalityIcon modality={s.modality} />
                  <span className="flex-1 capitalize">{s.modality}</span>
                  <ZoneChip zone="E" />
                  <span className="tabular-nums">{formatKm(s.distance)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        <section>
          <h2 className="mb-3 text-headline">Quick Log</h2>
          <div className="quick-presets">
            {quick.map((p) => (
              <Button
                key={p.id}
                to={`/log?preset=${encodeURIComponent(p.id)}`}
                variant="secondary"
                leading={<ModalityIcon modality={p.modality} />}
              >
                {p.name}
              </Button>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-headline">This Week’s Sessions</h2>
          {week.entries.length ? (
            <ListGroup>
              {week.entries.map((e) => (
                <ListRow
                  key={e.id}
                  to={`/entries/${e.id}`}
                  title={e.title}
                  leading={<ModalityIcon modality={e.modality} />}
                  subtitle={
                    <span className="flex flex-wrap items-center gap-2">
                      <ZoneChip zone={e.zone} />
                      <span>
                        {formatWeekday(e.date)} · {formatKm(e.distance_m)}
                      </span>
                    </span>
                  }
                  trailing={
                    <span className="flex flex-col items-end gap-1">
                      <span className="text-subhead text-text">{formatNumber(e.equiv_m)}</span>
                      <span className="text-caption">E-meters</span>
                    </span>
                  }
                />
              ))}
            </ListGroup>
          ) : (
            <EmptyState
              icon={<Activity size={20} strokeWidth={1.75} />}
              title="No Sessions Yet"
              body="Your extra work starts here"
              action={<Button to="/log">Log Session</Button>}
            />
          )}
        </section>
        {pinned.length > 0 && (
          <section className="xl:hidden">
            <h2 className="mb-3 text-headline">Pinned Announcements</h2>
            <div className="space-y-4">
              {pinned.map((a) => (
                <Card key={a.id}>
                  <h3 className="text-headline">{a.title}</h3>
                  <p className="mt-2 text-subhead text-muted">{a.body}</p>
                  <p className="mt-4 text-caption text-muted">
                    {a.author.name} · {formatEntryDate(a.created_at.slice(0, 10), config.today)}
                  </p>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
