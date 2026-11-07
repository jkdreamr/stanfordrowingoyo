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
        className="min-h-11 text-left text-footnote text-muted hover:text-text"
        onClick={() => setOpen(true)}
      >
        {withTeammates(users)}
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
