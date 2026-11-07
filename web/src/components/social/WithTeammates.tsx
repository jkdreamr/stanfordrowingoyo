import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PublicUser } from '../../../../shared/types';
import { withTeammates } from '../../lib/social';
import { Avatar, ListGroup, Sheet } from '../ui';

export function WithTeammates({ users = [] }: { users: PublicUser[] }) {
  const [open, setOpen] = useState(false);
  if (!users.length) return null;
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="flex min-h-11 items-center gap-2 text-left text-footnote text-muted"
        aria-label={withTeammates(users)}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true" className="flex -space-x-2">
          {users.slice(0, 3).map((u) => (
            <span
              key={u.id}
              className="rounded-full ring-2 ring-surface [&>.ui-avatar]:!h-6 [&>.ui-avatar]:!w-6 [&>.ui-avatar]:!text-[12px]"
            >
              <Avatar name={u.name} imageId={u.avatar_image_id} size="sm" />
            </span>
          ))}
        </span>
        <span>
          with <span className="font-medium text-text">{users[0].name}</span>
          {users.length > 1 && (
            <>
              {' '}
              and{' '}
              <span className="font-medium text-text">
                {users.length === 2 ? users[1].name : `${users.length - 1} others`}
              </span>
            </>
          )}
        </span>
      </button>
      {open && (
        <Sheet open onClose={() => setOpen(false)} title="With">
          <ListGroup>
            {users.map((u) => (
              <Link
                key={u.id}
                to={`/users/${u.id}`}
                className="ui-row text-text"
                onClick={() => setOpen(false)}
              >
                <span aria-hidden="true" className="shrink-0">
                  <Avatar name={u.name} imageId={u.avatar_image_id} />
                </span>
                <span className="min-w-0 flex-1 break-words">{u.name}</span>
              </Link>
            ))}
          </ListGroup>
        </Sheet>
      )}
    </div>
  );
}
