import { useState } from 'react';
import { Check, CircleX, Users } from 'lucide-react';
import type { PublicUser } from '../../../../shared/types';
import { useUsers } from '../../lib/queries';
import { normalizeName } from '../../lib/social';
import { Avatar, Button, EmptyState, ListGroup, Sheet, TextField } from '../ui';
import { LoadState } from '../shell/LoadState';

export function TeammatePicker({
  self,
  selected,
  onChange,
  onClose,
}: {
  self: string;
  selected: PublicUser[];
  onChange: (users: PublicUser[]) => void;
  onClose: () => void;
}) {
  const users = useUsers();
  const [search, setSearch] = useState('');
  const matches = (users.data ?? [])
    .filter(
      (u) => u.active && u.id !== self && normalizeName(u.name).includes(normalizeName(search)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Sheet
      open
      onClose={onClose}
      title="Tag Teammates"
      footer={
        <Button fullWidth onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="[&_label]:sr-only">
        <TextField
          label="Search Teammates"
          type="text"
          inputMode="search"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          trailing={
            search ? (
              <button
                type="button"
                aria-label="Clear Search"
                className="flex min-h-11 min-w-11 items-center justify-center text-muted"
                onClick={() => setSearch('')}
              >
                <CircleX size={20} aria-hidden="true" />
              </button>
            ) : undefined
          }
        />
      </div>
      <div className="mt-4">
        {!users.data ? (
          <LoadState error={users.isError} retry={() => void users.refetch()} />
        ) : !matches.length ? (
          <EmptyState
            icon={<Users size={20} />}
            title="No Teammates Found"
            action={
              search ? (
                <Button variant="secondary" onClick={() => setSearch('')}>
                  Clear Search
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ListGroup>
            {matches.map((u) => {
              const checked = selected.some((s) => s.id === u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  className="ui-row disabled:opacity-40"
                  aria-pressed={checked}
                  disabled={!checked && selected.length >= 10}
                  onClick={() =>
                    onChange(checked ? selected.filter((s) => s.id !== u.id) : [...selected, u])
                  }
                >
                  <span aria-hidden="true" className="shrink-0">
                    <Avatar name={u.name} imageId={u.avatar_image_id} />
                  </span>
                  <span className="min-w-0 flex-1 break-words text-left">{u.name}</span>
                  {checked && (
                    <Check aria-hidden="true" size={20} className="shrink-0 text-accent-ink" />
                  )}
                </button>
              );
            })}
          </ListGroup>
        )}
      </div>
    </Sheet>
  );
}
