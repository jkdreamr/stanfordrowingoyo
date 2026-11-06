import { Fragment, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { equivalentMeters, ZONES } from '../../../shared/math';
import type { Config, GroupKey, Modality, PlanSlot, User } from '../../../shared/types';
import { useConfig, useMe, usePlan } from '../lib/queries';
import { formatEMeters, formatMeters, formatSplit, parseSplit } from '../lib/format';
import {
  Button,
  Card,
  EmptyState,
  NumberField,
  PageHeader,
  SegmentedControl,
  Tabs,
  TextField,
  ZoneChip,
} from '../components/ui';
import { LoadState } from '../components/shell/LoadState';
import { scheduleWeeks, SLOTS } from './plan/schedule';
import { formulaFactor, targetDistance, zonePace } from './plan/calculator';
const GROUPS = [
  { value: 'frosh', label: 'Frosh' },
  { value: 'normal', label: 'Normal' },
  { value: 'u23', label: 'U23' },
] as const;
const MODES = [
  { value: 'erg', label: 'Erg' },
  { value: 'bike', label: 'Bike' },
  { value: 'run', label: 'Run' },
] as const;
const NAMES = {
  schedule: 'Schedule',
  guidance: 'Guidance',
  menu: 'Workout Menu',
  calculator: 'Calculator',
};
type TabKey = keyof typeof NAMES;
export default function Plan() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: TabKey =
    requested && Object.hasOwn(NAMES, requested) ? (requested as TabKey) : 'schedule';
  const changeTab = (value: TabKey) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('tab', value);
        return next;
      },
      { replace: true },
    );
  useEffect(() => {
    if (requested !== null && requested !== tab)
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set('tab', tab);
          return next;
        },
        { replace: true },
      );
  }, [requested, tab, setParams]);
  const config = useConfig();
  const me = useMe();
  return (
    <>
      <PageHeader title="Plan" />
      <Tabs
        label="Plan"
        value={tab}
        onChange={changeTab}
        tabs={(Object.keys(NAMES) as TabKey[]).map((value) => ({
          value,
          label: NAMES[value],
          content:
            value !== tab ? null : !config.data || !me.data ? (
              <LoadState
                error={config.isError || me.isError}
                retry={() => {
                  void config.refetch();
                  void me.refetch();
                }}
              />
            ) : value === 'schedule' ? (
              <Schedule initialGroup={me.data.group_key} />
            ) : value === 'guidance' ? (
              <Guidance config={config.data} group={me.data.group_key} />
            ) : value === 'menu' ? (
              <WorkoutMenu config={config.data} />
            ) : (
              <Calculator config={config.data} user={me.data} />
            ),
        }))}
      />
    </>
  );
}
function NoItems({ title }: { title: string }) {
  return (
    <EmptyState
      icon={<CalendarDays size={20} strokeWidth={1.75} />}
      title={title}
      body="Check back when the team plan is updated"
    />
  );
}
function SlotItem({ item }: { item: PlanSlot }) {
  return (
    <div
      className={
        'min-w-0 rounded-control p-3 ' +
        (item.kind === 'team' ? 'border border-divider bg-surface' : 'bg-surface-2')
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-caption font-semibold">
        <span>{item.kind === 'oyo' ? 'OYO' : 'Team'}</span>
        {item.kind === 'oyo' && item.zone && <ZoneChip zone={item.zone} />}
      </div>
      <p className="break-words text-footnote">{item.text}</p>
    </div>
  );
}
function Schedule({ initialGroup }: { initialGroup: GroupKey }) {
  const [group, setGroup] = useState(initialGroup);
  const plan = usePlan({ group });
  return (
    <div className="screen-stack">
      <SegmentedControl label="Group" value={group} onChange={setGroup} options={GROUPS} />
      {!plan.data ? (
        <LoadState error={plan.isError} retry={() => void plan.refetch()} />
      ) : !plan.data.slots.length ? (
        <NoItems title="No Schedule Yet" />
      ) : (
        scheduleWeeks(plan.data).map((week) => (
          <section key={week.week}>
            <h2 className="text-title3">Week {week.week}</h2>
            {week.total && (
              <p className="mt-1 text-subhead tabular-nums text-muted">{week.total}</p>
            )}
            <div className="mt-4 space-y-4 lg:hidden">
              {week.days.map((day) => (
                <div key={day.name}>
                  <h3 className="mb-2 text-headline">{day.name}</h3>
                  {day.off ? (
                    <p className="text-subhead text-muted">Off</p>
                  ) : (
                    <div className="space-y-2">
                      {day.slots.map((item) => (
                        <div
                          key={item.slot}
                          className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-2"
                        >
                          <span className="pt-3 text-caption tabular-nums text-muted">
                            {item.slot}
                          </span>
                          <SlotItem item={item} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 hidden grid-cols-[48px_repeat(7,minmax(0,1fr))] gap-2 lg:grid">
              <div aria-hidden="true" />
              {week.days.map((day) => (
                <h3 key={day.name} className="text-footnote font-semibold">
                  {day.name.slice(0, 3)}
                </h3>
              ))}
              {SLOTS.map((slot, row) => (
                <Fragment key={slot}>
                  <p className="pt-3 text-caption tabular-nums text-muted">{slot}</p>
                  {week.days.map((day) => {
                    const item = day.slots.find((s) => s.slot === slot);
                    return (
                      <div key={day.name + slot} className="min-w-0">
                        {item ? (
                          <SlotItem item={item} />
                        ) : day.off && row === 0 ? (
                          <p className="p-3 text-footnote text-muted">Off</p>
                        ) : null}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
function Guidance({ config, group }: { config: Config; group: GroupKey }) {
  const rows = [
    ['D Erg Session', 'D 6k +10 ± 2.5', '1x', '20k+'],
    ['Running', 'D', '2x', '7.5k+'],
    ['Lifting with Evan*', '–', '2x', '10k total'],
  ];
  return (
    <div className="screen-stack">
      <section>
        <h2 className="mb-4 text-title3">OYO Workouts Per Fortnight</h2>
        <div className="space-y-3">
          {rows.map(([session, splits, frequency, load]) => (
            <Card key={session}>
              <h3 className="text-headline">{session}</h3>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-footnote tabular-nums">
                {[
                  ['Splits', splits],
                  ['Frequency', frequency],
                  ['Load', load],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted">{label}</dt>
                    <dd className="mt-1">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-footnote text-muted">
          * Extra lifts are recommended for people who have talked about it with the coaches.
        </p>
      </section>
      <section>
        <h2 className="mb-4 text-title3">Weekly Volume Targets</h2>
        <div className="space-y-3">
          {GROUPS.map(({ value, label }) => (
            <Card key={value} className={group === value ? 'bg-selected' : ''}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-headline">{label}</h3>
                <p className="text-subhead tabular-nums">
                  {formatEMeters(config.group_targets[value])}
                </p>
              </div>
              {group === value && <p className="mt-2 text-footnote text-accent-ink">Your Group</p>}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
function WorkoutMenu({ config }: { config: Config }) {
  const [mode, setMode] = useState<Modality>('erg');
  const presets = config.presets
    .filter((p) => p.active && p.modality === mode)
    .sort((a, b) => a.sort - b.sort);
  return (
    <div className="screen-stack">
      <SegmentedControl label="Modality" value={mode} onChange={setMode} options={MODES} />
      {!presets.length ? (
        <NoItems title="No Workouts Yet" />
      ) : (
        ZONES.map((zone) => {
          const rows = presets.filter((p) => p.zone === zone);
          return (
            rows.length > 0 && (
              <section key={zone}>
                <h2 className="mb-3">
                  <ZoneChip zone={zone} />
                </h2>
                <Card>
                  <div className="divide-y divide-divider">
                    {rows.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <h3 className="break-words text-subhead font-semibold">{p.name}</h3>
                          <p className="mt-1 text-footnote tabular-nums text-muted">
                            {p.distance_m === null
                              ? 'Enter Meters ' + formulaFactor(mode, zone, config)
                              : formatMeters(p.distance_m) +
                                ' · ' +
                                formatEMeters(
                                  equivalentMeters(
                                    p.distance_m,
                                    mode,
                                    zone,
                                    config.mode_factors,
                                    config.zone_factors,
                                  ),
                                )}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          to={'/log?preset=' + encodeURIComponent(p.id)}
                          className="shrink-0"
                        >
                          Log This
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            )
          );
        })
      )}
    </div>
  );
}
function Calculator({ config, user }: { config: Config; user: User }) {
  const [six, setSix] = useState(
    user.best6k_split_s === null ? '' : formatSplit(user.best6k_split_s),
  );
  const [two, setTwo] = useState(
    user.best2k_split_s === null ? '' : formatSplit(user.best2k_split_s),
  );
  const [target, setTarget] = useState('10');
  const valid = target.trim() !== '' && Number.isFinite(Number(target)) && Number(target) > 0;
  return (
    <div className="screen-stack">
      <section>
        <h2 className="mb-4 text-title3">Pace</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: 'Best 6k Split', value: six, set: setSix },
            { label: 'Best 2k Split', value: two, set: setTwo },
          ].map(({ label, value, set }) => (
            <TextField
              key={label}
              label={label}
              placeholder="1:45.0"
              inputMode="decimal"
              value={value}
              onChange={(e) => set(e.target.value)}
              error={
                value.trim() && parseSplit(value) === null ? 'Enter a split like 1:45.0' : undefined
              }
            />
          ))}
        </div>
        <Card className="mt-4">
          <dl className="divide-y divide-divider">
            {ZONES.map((zone) => (
              <div
                key={zone}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <dt>
                  <ZoneChip zone={zone} />
                </dt>
                <dd className="text-subhead tabular-nums">
                  {zonePace(zone, parseSplit(six), parseSplit(two))}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>
      <section>
        <h2 className="mb-4 text-title3">Distance</h2>
        <NumberField
          label="Target E-km"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          error={!valid ? 'Enter a positive target in E-km' : undefined}
        />
        <Card className="mt-4">
          <table className="w-full table-fixed text-right text-footnote tabular-nums">
            <caption className="sr-only">
              Physical distance in kilometers for your equivalent target
            </caption>
            <thead>
              <tr>
                <th className="pb-3 text-left font-semibold">Zone</th>
                {MODES.map((m) => (
                  <th key={m.value} className="pb-3 font-semibold">
                    {m.label}
                    <span className="block font-normal text-muted">km</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ZONES.map((zone) => (
                <tr key={zone} className="border-t border-divider">
                  <th className="py-3 text-left">
                    <ZoneChip zone={zone} />
                  </th>
                  {MODES.map((m) => (
                    <td key={m.value} className="py-3">
                      {valid
                        ? targetDistance(Number(target), m.value, zone, config).replace(' km', '')
                        : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
