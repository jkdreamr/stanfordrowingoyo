import { useParams } from 'react-router-dom';
import { Activity, UserRound } from 'lucide-react';
import { useConfig, useEntries, useMe, useProfile } from '../lib/queries';
import { ApiClientError } from '../lib/api';
import { formatNumber } from '../lib/format';
import { publicSubtitle } from '../lib/social';
import { Avatar, Button, EmptyState, PageHeader, SeasonChart } from '../components/ui';
import { LoadState } from '../components/shell/LoadState';
import { EntryCard } from '../components/social/EntryCard';
import { WeekData } from '../components/social/WeekData';

export default function RowerProfile() {
  const { id = '' } = useParams();
  const profile = useProfile(id);
  const workouts = useEntries(`user:${id}`);
  const { data: me } = useMe();
  const { data: config } = useConfig();
  const data = profile.data;
  return (
    <>
      <PageHeader title="Profile" back />
      <div className="screen-stack">
        {!data ? (
          profile.error instanceof ApiClientError && profile.error.status === 404 ? (
            <EmptyState
              icon={<UserRound size={20} strokeWidth={1.75} aria-hidden="true" />}
              title="Rower Not Found"
              body="This profile is unavailable"
              action={<Button to="/team">View Team</Button>}
            />
          ) : (
            <LoadState error={profile.isError} retry={() => void profile.refetch()} />
          )
        ) : (
          <>
            <section aria-label="Public Profile">
              <div className="flex items-start gap-4">
                <Avatar name={data.user.name} imageId={data.user.avatar_image_id} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-title1">{data.user.name}</h2>
                  <p className="mt-1 text-subhead text-muted">{publicSubtitle(data.user)}</p>
                  {data.user.bio && (
                    <p className="mt-3 whitespace-pre-wrap break-words text-callout">
                      {data.user.bio}
                    </p>
                  )}
                  {me?.id === data.user.id && (
                    <Button className="mt-3" variant="secondary" to="/me/edit">
                      Edit Profile
                    </Button>
                  )}
                </div>
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
                <div>
                  <dt className="text-footnote text-muted">Season Total</dt>
                  <dd className="mt-1 text-title3 tabular-nums">
                    {formatNumber(data.stats.total_m)}
                    <span className="mt-1 block text-caption font-normal text-muted">E-meters</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-footnote text-muted">Weeks On Target</dt>
                  <dd className="mt-1 text-title3 tabular-nums">
                    {formatNumber(data.stats.weeks.filter((w) => w.hit_target).length)}
                  </dd>
                </div>
                <div>
                  <dt className="text-footnote text-muted">Streak</dt>
                  <dd
                    className={`mt-1 text-title3 tabular-nums ${data.stats.streak > 0 ? 'text-highlight-ink' : ''}`}
                  >
                    {formatNumber(data.stats.streak)} {data.stats.streak === 1 ? 'week' : 'weeks'}
                  </dd>
                </div>
                <div>
                  <dt className="text-footnote text-muted">Best Week</dt>
                  <dd className="mt-1 text-title3 tabular-nums">
                    {formatNumber(data.stats.best_week?.total_m ?? 0)}
                    <span className="mt-1 block text-caption font-normal text-muted">E-meters</span>
                  </dd>
                </div>
              </dl>
            </section>
            <SeasonChart userId={id} isMe={false} />
            <WeekData key={id} weeks={data.stats.weeks} />
            <section aria-label="Workouts">
              <h2 className="mb-4 text-title3">Workouts</h2>
              {!workouts.data ? (
                <LoadState error={workouts.isError} retry={() => void workouts.refetch()} />
              ) : (
                <>
                  <div className="space-y-4">
                    {workouts.data.pages
                      .flatMap((p) => p.items)
                      .map((entry) => (
                        <EntryCard key={entry.id} entry={entry} config={config} />
                      ))}
                  </div>
                  {!workouts.data.pages.some((p) => p.items.length) && (
                    <EmptyState
                      icon={<Activity size={20} strokeWidth={1.75} aria-hidden="true" />}
                      title="No Workouts Yet"
                      body="Shared workouts will appear here"
                    />
                  )}
                  {workouts.hasNextPage && (
                    <Button
                      className="mt-4"
                      variant="secondary"
                      fullWidth
                      loading={workouts.isFetchingNextPage}
                      onClick={() => void workouts.fetchNextPage()}
                    >
                      Load More
                    </Button>
                  )}
                  {workouts.isError && <LoadState error retry={() => void workouts.refetch()} />}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
