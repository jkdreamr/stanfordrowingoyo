import { useState, type CSSProperties } from 'react';
import { ThumbsUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { EntryDetail } from '../../../../shared/types';
import { useKudos, useKudosGivers } from '../../lib/queries';
import { Avatar, Button, EmptyState, ListGroup, Sheet, Skeleton, useToast } from '../ui';

export function KudosButton({ entry }: { entry: EntryDetail }) {
  const mutation = useKudos();
  const toast = useToast();
  const [give, setGive] = useState(0);
  const [open, setOpen] = useState(false);
  const givers = useKudosGivers(entry.id, open);
  return (
    <>
      <div className="entry-action">
        <button
          type="button"
          className="entry-action-icon"
          aria-label="Kudos"
          aria-pressed={entry.has_kudos}
          disabled={mutation.isPending}
          onClick={() => {
            if (!entry.has_kudos) setGive((n) => n + 1);
            mutation.mutate(
              { id: entry.id, hasKudos: !entry.has_kudos },
              {
                onError: () => {
                  setGive(0);
                  toast.show({ title: 'Kudos not saved. Try again', tone: 'error' });
                },
              },
            );
          }}
        >
          <span
            aria-hidden="true"
            className={`kudos-icon ${give > 0 && entry.has_kudos ? 'is-giving' : ''}`}
          >
            <ThumbsUp
              key={give}
              className={give > 0 && entry.has_kudos ? 'social-kudos-give' : ''}
              onAnimationEnd={() => setGive(0)}
              size={20}
              strokeWidth={1.75}
              fill={entry.has_kudos ? 'currentColor' : 'none'}
            />
            {give > 0 &&
              entry.has_kudos &&
              [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                <i
                  key={angle}
                  className="kudos-spark"
                  style={{ '--a': `${angle}deg` } as CSSProperties}
                />
              ))}
          </span>
        </button>
        {entry.kudos_count > 0 ? (
          <Button
            variant="plain"
            className="entry-action-count"
            aria-label={`View ${entry.kudos_count} ${entry.kudos_count === 1 ? 'Kudo' : 'Kudos'}`}
            onClick={(event) => {
              event.currentTarget.focus({ preventScroll: true });
              setOpen(true);
            }}
          >
            <span key={entry.kudos_count} className={give > 0 ? 'kudos-count' : undefined}>
              {entry.kudos_count}
            </span>
          </Button>
        ) : (
          <span className="entry-action-count text-muted">0</span>
        )}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Kudos">
        {givers.isPending ? (
          <div role="status" aria-label="Loading Kudos">
            <span className="sr-only">Loading Kudos</span>
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 py-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : givers.isError ? (
          <div className="space-y-4">
            <p role="alert" className="text-danger">
              Could not load kudos
            </p>
            <Button variant="secondary" onClick={() => void givers.refetch()}>
              Retry
            </Button>
          </div>
        ) : !givers.data?.length ? (
          <EmptyState icon={<ThumbsUp size={20} />} title="No Kudos Yet" />
        ) : (
          <ListGroup>
            {givers.data.map((user) => (
              <Link
                key={user.id}
                to={`/users/${user.id}`}
                className="ui-row text-text"
                onClick={() => setOpen(false)}
              >
                <span aria-hidden="true" className="shrink-0">
                  <Avatar name={user.name} imageId={user.avatar_image_id} />
                </span>
                <span className="min-w-0 flex-1 break-words">{user.name}</span>
              </Link>
            ))}
          </ListGroup>
        )}
      </Sheet>
    </>
  );
}
