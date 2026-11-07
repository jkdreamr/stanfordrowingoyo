import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import type { Announcement } from '../../../shared/types';
import { useAnnouncements, useNotifications, useReadNotifications } from '../lib/queries';
import { groupNotifications, notificationAnnouncements, relativeTime } from '../lib/social';
import { Avatar, EmptyState, PageHeader, Sheet } from '../components/ui';
import { LoadState } from '../components/shell/LoadState';

export default function Notifications() {
  const query = useNotifications();
  const read = useReadNotifications();
  const { data: announcements = [] } = useAnnouncements();
  const [unread, setUnread] = useState<Set<string> | null>(null);
  const attempted = useRef(new Set<string>());
  const [opened, setOpened] = useState<Announcement[] | null>(null);
  useEffect(() => {
    if (!query.data) return;
    const ids = [
      ...new Set(
        query.data.filter((n) => !n.read_at && !attempted.current.has(n.id)).map((n) => n.id),
      ),
    ];
    if (!ids.length) return;
    ids.forEach((id) => attempted.current.add(id));
    setUnread((previous) => new Set([...(previous ?? []), ...ids]));
    read.mutate({ body: { ids } });
  }, [query.data, read.mutate]);
  return (
    <>
      <PageHeader title="Notifications" back="/feed" />
      <div className="screen-stack">
        {!query.data ? (
          <LoadState error={query.isError} retry={() => void query.refetch()} />
        ) : !query.data.length ? (
          <EmptyState
            icon={<Bell size={20} strokeWidth={1.75} />}
            title="No Notifications Yet"
            body="Team updates will appear here"
          />
        ) : (
          ['New', 'Earlier'].map((section) => {
            const items = query.data.filter(
              (n) => (unread?.has(n.id) || !n.read_at) === (section === 'New'),
            );
            return items.length ? (
              <section key={section}>
                <h2 className="mb-3 text-headline">{section}</h2>
                <ul className="overflow-hidden rounded-xl border border-divider bg-surface divide-y divide-divider">
                  {groupNotifications(items).map((group) => {
                    const n = group[0];
                    const actors = [
                      ...new Map(group.map((item) => [item.actor_id, item.actor])).values(),
                    ];
                    const actorText = `${n.actor.name}${actors.length > 1 ? ` and ${actors.length - 1} ${actors.length === 2 ? 'other' : 'others'}` : ''}`;
                    const verb =
                      n.kind === 'kudos'
                        ? 'gave kudos to'
                        : n.kind === 'comment'
                          ? 'commented on'
                          : 'posted an announcement';
                    const content = (
                      <>
                        <Avatar name={n.actor.name} imageId={n.actor.avatar_image_id} />
                        <span className="min-w-0 flex-1 font-normal text-text">
                          <span className="font-semibold">{actorText}</span> <span>{verb}</span>
                          {n.kind !== 'announcement' && (
                            <>
                              {' '}
                              <span className="font-semibold">{n.entry_title ?? 'a workout'}</span>
                            </>
                          )}
                          <span className="mt-1 block text-caption font-normal text-muted">
                            {relativeTime(n.created_at)}
                          </span>
                        </span>
                        {section === 'New' && (
                          <>
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-accent"
                              aria-hidden="true"
                            />
                            <span className="sr-only">Unread</span>
                          </>
                        )}
                      </>
                    );
                    return (
                      <li key={n.id} className={section === 'New' ? 'bg-selected' : ''}>
                        {n.kind === 'announcement' ? (
                          <button
                            className="flex min-h-11 w-full items-center gap-3 p-4 text-left text-callout text-text"
                            onClick={() => {
                              setOpened(notificationAnnouncements(n, announcements));
                            }}
                          >
                            {content}
                          </button>
                        ) : (
                          <Link
                            className="flex min-h-11 items-center gap-3 p-4 text-callout text-text"
                            to={`/entries/${n.entry_id}${n.kind === 'comment' ? '#comments' : ''}`}
                          >
                            {content}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null;
          })
        )}
        {read.isError && (
          <p role="alert" className="text-danger">
            Could not mark notifications read
          </p>
        )}
        <Sheet open={opened !== null} onClose={() => setOpened(null)} title="Announcements">
          {opened?.length ? (
            opened.map((a) => (
              <article key={a.id} className="mb-6">
                <h2 className="text-title3">{a.title}</h2>
                <p className="mt-3 whitespace-pre-wrap text-callout">{a.body}</p>
                <p className="mt-3 text-caption text-muted">{a.author.name}</p>
              </article>
            ))
          ) : (
            <p className="text-muted">No announcements available</p>
          )}
        </Sheet>
      </div>
    </>
  );
}
