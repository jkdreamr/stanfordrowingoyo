import { Megaphone, Pin } from 'lucide-react';
import { useAnnouncement, useAnnouncements } from '../lib/queries';
import { useSearchParams } from 'react-router-dom';
import { formatEntryDate } from '../lib/format';
import { Button, Card, EmptyState, PageHeader } from '../components/ui';
import { LoadState } from '../components/shell/LoadState';
import { ApiClientError } from '../lib/api';

export default function Announcements() {
  const [params] = useSearchParams();
  const id = params.get('announcement') ?? '';
  const list = useAnnouncements(!id);
  const specific = useAnnouncement(id);
  const query = id ? specific : list;
  const announcements = [...(id ? (specific.data ? [specific.data] : []) : (list.data ?? []))].sort(
    (a, b) => b.created_at.localeCompare(a.created_at),
  );
  return (
    <>
      <PageHeader title="Announcements" back="/" />
      <div className="screen-stack">
        {id && query.error instanceof ApiClientError && query.error.status === 404 ? (
          <EmptyState
            icon={<Megaphone size={20} />}
            title="Announcement Removed"
            action={<Button to="/announcements">All Announcements</Button>}
          />
        ) : query.isError ? (
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
