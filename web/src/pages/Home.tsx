import { Activity } from 'lucide-react';
import {
  useAnnouncements,
  useConfig,
  useSeasonStats,
  useWeekStats,
  useTarget,
  useMe,
} from '../lib/queries';
import { formatEntryDate, formatKm, formatNumber, formatWeekday } from '../lib/format';
import { daysLeft, finishWeek } from '../lib/week';
import { useEffect, useState } from 'react';
import { clearTargetFinish, pendingTargetFinish } from '../lib/targetFinish';
import {
  Button,
  Card,
  EmptyState,
  ListGroup,
  ListRow,
  PageHeader,
  ZoneChip,
} from '../components/ui';
import { HeaderActions } from '../components/shell/HeaderActions';
import { LoadState } from '../components/shell/LoadState';
import { ModalityIcon } from '../components/shell/ModalityIcon';
import { TodaysPlan } from '../components/plan/TodaysPlan';
import { InstallBanner } from '../components/InstallBanner';
import { LastWeekRecap } from '../components/LastWeekRecap';
import { TeamChallenges } from '../components/TeamChallenges';
import { PullToRefresh } from '../components/social/PullToRefresh';
import { useRefreshVisible } from '../lib/useRefreshVisible';
import { Celebration } from '../components/ui/Celebration';
import { WeekHero } from '../components/home/WeekHero';
export default function Page() {
  const refresh = useRefreshVisible();
  const { data: user } = useMe();
  const { data: target } = useTarget();
  const configQuery = useConfig();
  const weekQuery = useWeekStats();
  const { data: season } = useSeasonStats();
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
        <PageHeader title="This Week" trailing={<HeaderActions settings />} inline />
        <LoadState
          error={configQuery.isError || weekQuery.isError}
          retry={() => {
            void configQuery.refetch();
            void weekQuery.refetch();
          }}
        />
      </>
    );
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
      <PageHeader title="This Week" trailing={<HeaderActions settings />} inline />
      <PullToRefresh
        label="Home"
        onRefresh={refresh}
        className="screen-stack relative [&>.social-refresh-slot]:absolute [&>.social-refresh-slot]:inset-x-0 [&>.social-refresh-slot]:top-0"
      >
        {user && <Celebration key={user.id} user={user} />}
        <InstallBanner />
        {user && <LastWeekRecap user={user} config={config} />}
        <WeekHero
          week={week}
          today={config.today}
          days={days}
          personal={target?.source === 'personal'}
          streak={season?.streak}
          previous={finish?.target === week.target_m ? finish.previous : undefined}
          finishing={!!finish}
        />
        {finish && (
          <span role="status" className="sr-only">
            Weekly target hit
          </span>
        )}
        <TeamChallenges today={config.today} />
        <TodaysPlan today={config.today} />
        <ListGroup>
          <ListRow title="Announcements" to="/announcements" />
        </ListGroup>
        {!week.hit_target && (
          <Card>
            <h2 className="text-headline">Finish This Week</h2>
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
              action={<Button to="/log">Log Workout</Button>}
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
      </PullToRefresh>
    </>
  );
}
