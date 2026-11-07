import { Megaphone, Pin } from 'lucide-react';
import { useAnnouncements } from '../lib/queries';
import { formatEntryDate } from '../lib/format';
import { Button, Card, EmptyState, PageHeader } from '../components/ui';
import { LoadState } from '../components/shell/LoadState';

export default function Announcements() {
  const query = useAnnouncements();
  const announcements = [...(query.data ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  return (
    <>
      <PageHeader title="Announcements" back="/" />
      <div className="screen-stack">
        {query.isError ? (
          <LoadState error retry={() => void query.refetch()} />
        ) : !query.data ? (
          <LoadState />
        ) : !announcements.length ? (
          <EmptyState
            icon={<Megaphone size={20} strokeWidth={1.75} />}
            title="No Announcements Yet"
            action={<Button to="/feed">Open Feed</Button>}
          />
        ) : (
          announcements.map((announcement) => (
            <article key={announcement.id} aria-label={announcement.title}>
              <Card>
                <h2 className="break-words text-headline">{announcement.title}</h2>
                <p className="mt-3 whitespace-pre-wrap break-words text-callout">
                  {announcement.body}
                </p>
                <p className="mt-4 text-caption text-muted">
                  {announcement.pinned && (
                    <span className="mr-1 inline-flex items-center gap-1">
                      <Pin size={16} strokeWidth={1.75} aria-hidden="true" />
                      Pinned ·
                    </span>
                  )}
                  {announcement.author.name} ·{' '}
                  <time dateTime={announcement.created_at}>
                    {formatEntryDate(announcement.created_at.slice(0, 10))}
                  </time>
                </p>
              </Card>
            </article>
          ))
        )}
      </div>
    </>
  );
}
