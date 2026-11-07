import { History } from 'lucide-react';
import { Avatar, Button, EmptyState, ListGroup, PageHeader } from '../../components/ui';
import { LoadState } from '../../components/shell/LoadState';
import { useAdminUsers, useAudit, useRoster } from '../../lib/queries';
import { relativeAuditTime } from './operations';
import { auditEntry } from './audit';

export default function AuditLog() {
  const audit = useAudit();
  const users = useAdminUsers();
  const roster = useRoster();
  const rows = audit.data?.pages.flatMap((page) => page.items);
  const names = new Map(users.data?.map((user) => [user.id, user.name]));
  for (const row of roster.data ?? []) names.set(row.id, row.name);
  return (
    <>
      <PageHeader title="Audit Log" back="/admin" />
      <div className="screen-stack">
        {!rows ? (
          <LoadState error={audit.isError} retry={() => void audit.refetch()} />
        ) : rows.length ? (
          <>
            {users.isError && (
              <p className="text-subhead text-muted">
                Some staff names could not load.{' '}
                <Button variant="plain" onClick={() => void users.refetch()}>
                  Retry Names
                </Button>
              </p>
            )}
            <ListGroup footer="Newest activity first. Join codes and passwords are never shown here.">
              {rows.map((row) => {
                const summary = auditEntry(row, names);
                const actor = users.data?.find((user) => user.id === row.actor_id);
                const actorName = actor?.name ?? 'A staff member';
                const time = new Date(row.created_at);
                const absolute = Number.isFinite(time.getTime())
                  ? new Intl.DateTimeFormat('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'America/Los_Angeles',
                    }).format(time)
                  : 'Unknown time';
                return (
                  <article
                    key={row.id}
                    className="flex gap-3 border-b border-divider p-4 last:border-0"
                  >
                    <Avatar name={actorName} imageId={actor?.avatar_image_id} />
                    <div className="min-w-0 space-y-1">
                      <p className="break-words text-callout">
                        {actorName} {summary.sentence}
                      </p>
                      {summary.changes.length > 0 && (
                        <p className="text-subhead text-muted">{summary.changes.join(' · ')}</p>
                      )}
                      <time
                        dateTime={row.created_at}
                        title={`${absolute} Pacific`}
                        aria-label={`${relativeAuditTime(row.created_at)} · ${absolute} Pacific`}
                        className="block text-footnote text-muted"
                      >
                        {relativeAuditTime(row.created_at)}
                        <span className="hidden sm:inline"> · {absolute} Pacific</span>
                      </time>
                    </div>
                  </article>
                );
              })}
            </ListGroup>
            {audit.isFetchNextPageError && (
              <p role="alert" className="text-callout text-danger">
                Could not load more activity. Try again.
              </p>
            )}
            {audit.hasNextPage && (
              <Button
                variant="secondary"
                fullWidth
                loading={audit.isFetchingNextPage}
                onClick={() => void audit.fetchNextPage()}
              >
                Load More
              </Button>
            )}
          </>
        ) : (
          <EmptyState
            icon={<History size={20} />}
            title="No Activity Yet"
            body="Staff changes to team settings, accounts and content will appear here."
          />
        )}
      </div>
    </>
  );
}
