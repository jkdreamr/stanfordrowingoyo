import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, RefreshCw, Users } from 'lucide-react';
import { useConfig, useEntries } from '../lib/queries';
import { Button, EmptyState, IconButton, PageHeader } from '../components/ui';
import { HeaderActions } from '../components/shell/HeaderActions';
import { LoadState } from '../components/shell/LoadState';
import { EntryCard } from '../components/social/EntryCard';
import { FeedSkeleton } from '../components/social/FeedSkeleton';
import { PullToRefresh } from '../components/social/PullToRefresh';
export default function Page() {
  const feed = useEntries('feed');
  const { data: config } = useConfig();
  const navigate = useNavigate();
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([item]) => {
        if (item.isIntersecting && feed.hasNextPage && !feed.isFetching) void feed.fetchNextPage();
      },
      { rootMargin: '300px' },
    );
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [feed.hasNextPage, feed.isFetching, feed.fetchNextPage]);
  const entries = feed.data?.pages.flatMap((p) => p.items);
  return (
    <>
      <PageHeader
        title="Feed"
        trailing={
          <div className="flex items-center">
            <IconButton aria-label="Team" onClick={() => navigate('/team')}>
              <Users size={20} strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
            <IconButton
              aria-label="Refresh Feed"
              disabled={feed.isFetching}
              onClick={() => void feed.refetch()}
            >
              <RefreshCw size={20} strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
            <HeaderActions />
          </div>
        }
      />
      <div className="screen-stack">
        <PullToRefresh onRefresh={() => feed.refetch({ throwOnError: true })}>
          {!entries ? (
            feed.isError ? (
              <LoadState error retry={() => void feed.refetch()} />
            ) : (
              <FeedSkeleton />
            )
          ) : entries.length ? (
            <div className="space-y-4">
              {entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} config={config} />
              ))}
              <div ref={sentinel} />
              {feed.hasNextPage ? (
                <Button
                  variant="secondary"
                  fullWidth
                  loading={feed.isFetchingNextPage}
                  onClick={() => void feed.fetchNextPage()}
                >
                  Load More
                </Button>
              ) : (
                <p className="py-6 text-center text-subhead text-muted">You're all caught up</p>
              )}
              {feed.isError && <LoadState error retry={() => void feed.refetch()} />}
            </div>
          ) : (
            <EmptyState
              icon={<Activity size={20} strokeWidth={1.75} />}
              title="No Workouts Yet"
              body="See the work your teammates are putting in"
              action={<Button to="/log">Log Session</Button>}
            />
          )}
        </PullToRefresh>
      </div>
    </>
  );
}
