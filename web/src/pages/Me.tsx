import { useState } from 'react';
import { Activity, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Modality } from '../../../shared/types';
import { ZONES } from '../../../shared/math';
import {
  Avatar,
  Button,
  EmptyState,
  ListGroup,
  ListRow,
  PageHeader,
  SeasonChart,
  SegmentedControl,
  Select,
  Tabs,
  ZoneChip,
} from '../components/ui';
import { HeaderActions } from '../components/shell/HeaderActions';
import { LoadState } from '../components/shell/LoadState';
import { useConfig, useEntries, useMe, useSeasonStats, useTarget } from '../lib/queries';
import { formatEntryDate, formatKm, formatMeters } from '../lib/format';
import { MeStats } from './MeStats';
import { ErgTests } from '../components/ErgTests';

const groups = { frosh: 'Frosh', normal: 'Normal Non-Frosh', u23: 'U23 / Senior Hopefuls' };
const modes = [
  { value: 'all', label: 'All' },
  { value: 'erg', label: 'Erg' },
  { value: 'bike', label: 'Bike' },
  { value: 'run', label: 'Run' },
] as const;
export default function Me() {
  const me = useMe();
  const config = useConfig();
  const target = useTarget();
  const entries = useEntries('mine');
  const [period, setPeriod] = useState<'season' | 'year'>('season');
  const stats = useSeasonStats(
    period === 'year' && config.data ? { year: Number(config.data.today.slice(0, 4)) } : {},
  );
  const [modality, setModality] = useState<'all' | Modality>('all');
  const [zone, setZone] = useState('all');
  const header = <PageHeader title="Me" trailing={<HeaderActions settings />} />;
  if (me.isError || config.isError)
    return (
      <>
        {header}
        <LoadState
          error
          retry={() => {
            void me.refetch();
            void config.refetch();
          }}
        />
      </>
    );
  if (!me.data || !config.data)
    return (
      <>
        {header}
        <LoadState />
      </>
    );
  const user = me.data;
  const today = config.data.today;
  const allEntries = entries.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = allEntries.filter(
    (e) => (modality === 'all' || e.modality === modality) && (zone === 'all' || e.zone === zone),
  );
  const panel = stats.isError ? (
    <LoadState
      error
      retry={() => {
        void stats.refetch();
      }}
    />
  ) : !stats.data ? (
    <LoadState />
  ) : (
    <MeStats stats={stats.data} today={today} />
  );
  return (
    <>
      {header}
      <div className="space-y-6 px-4 pb-8">
        <section className="flex items-start gap-4 pt-6" aria-label="My Profile">
          <Link
            to="/me/edit"
            className="profile-photo-link"
            aria-label={user.avatar_image_id ? 'Change Profile Photo' : 'Add Photo'}
          >
            <span className="profile-photo-button">
              <Avatar name={user.name} imageId={user.avatar_image_id} size="lg" />
              <span className="profile-photo-badge">
                <Camera size={16} strokeWidth={1.75} aria-hidden="true" />
              </span>
            </span>
            {!user.avatar_image_id && <span className="profile-photo-caption">Add Photo</span>}
          </Link>
          <div className="min-w-0">
            <h2 className="break-words text-title1">{user.name}</h2>
            <p className="mt-1 text-footnote text-muted">
              {[
                groups[user.group_key],
                user.side &&
                  { port: 'Port', starboard: 'Starboard', both: 'Both Sides', cox: 'Coxswain' }[
                    user.side
                  ],
                user.class_year && `Class of ${user.class_year}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {user.bio && <p className="mt-3 text-callout">{user.bio}</p>}
            <Button to="/me/edit" variant="plain" className="[&]:px-0">
              Edit Profile
            </Button>
          </div>
        </section>
        <ErgTests user={user} today={today} own />
        <SeasonChart />
        <section aria-label="Training Statistics">
          <Tabs
            label="Statistics Period"
            value={period}
            onChange={setPeriod}
            tabs={[
              { value: 'season', label: 'Season', content: period === 'season' ? panel : null },
              { value: 'year', label: 'Calendar Year', content: period === 'year' ? panel : null },
            ]}
          />
        </section>
        <section aria-label="My Entries" className="space-y-4">
          <h2 className="text-title2">My Entries</h2>
          <SegmentedControl
            label="Entry Modality"
            value={modality}
            onChange={setModality}
            options={modes}
          />
          <Select label="Zone" value={zone} onChange={(e) => setZone(e.target.value)}>
            <option value="all">All Zones</option>
            {ZONES.map((z) => (
              <option key={z} value={z}>
                Zone {z}
              </option>
            ))}
          </Select>
          {entries.isError ? (
            <LoadState
              error
              retry={() => {
                void entries.refetch();
              }}
            />
          ) : entries.isPending ? (
            <LoadState />
          ) : filtered.length ? (
            <div className="overflow-hidden rounded-xl border border-divider bg-surface divide-y divide-divider">
              {filtered.map((entry) => (
                <Link
                  key={entry.id}
                  to={`/entries/${entry.id}`}
                  className="flex min-h-20 items-start justify-between gap-3 px-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">{entry.title || 'Training Session'}</p>
                    <p className="mt-1 text-footnote text-muted">
                      {formatEntryDate(entry.date, today)} · {formatKm(entry.distance_m)}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <ZoneChip zone={entry.zone} />
                    </div>
                  </div>
                  <p className="shrink-0 text-right text-subhead tabular-nums">
                    {formatMeters(entry.equiv_m)}
                    <span className="block text-caption text-muted">E-meters</span>
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Activity size={20} strokeWidth={1.75} />}
              title={allEntries.length ? 'No Matching Sessions' : 'No Sessions Yet'}
              body={allEntries.length ? 'Try another modality or zone' : undefined}
              action={
                allEntries.length ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setModality('all');
                      setZone('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                ) : (
                  <Button to="/log">Log Session</Button>
                )
              }
            />
          )}
          {entries.hasNextPage && (
            <Button
              fullWidth
              variant="secondary"
              loading={entries.isFetchingNextPage}
              onClick={() => {
                void entries.fetchNextPage();
              }}
            >
              Load More
            </Button>
          )}
        </section>
        <ListGroup header="Your Training">
          <ListRow title="Plan" to="/plan" />
          <ListRow title="Edit Profile" to="/me/edit" />
          <ListRow
            title="Weekly Target"
            to="/me/target"
            trailing={target.data ? formatMeters(target.data.target_m) : 'Not available'}
          />
          <ListRow title="Settings" to="/settings" />
          {user.role !== 'rower' && <ListRow title="Admin" to="/admin" />}
        </ListGroup>
      </div>
    </>
  );
}
