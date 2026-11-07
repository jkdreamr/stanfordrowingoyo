import { useState } from 'react';
import { Users } from 'lucide-react';
import { useUsers } from '../lib/queries';
import { normalizeName, publicSubtitle } from '../lib/social';
import { Avatar, EmptyState, ListGroup, ListRow, PageHeader, TextField } from '../components/ui';
import { LoadState } from '../components/shell/LoadState';

export default function Team() {
  const query = useUsers();
  const [search, setSearch] = useState('');
  const users = query.data
    ?.filter((u) => normalizeName(u.name).includes(normalizeName(search)))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <PageHeader title="Team" back />
      <div className="screen-stack">
        <TextField
          label="Search Team"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {!users ? (
          <LoadState error={query.isError} retry={() => void query.refetch()} />
        ) : !users.length ? (
          <EmptyState
            icon={<Users size={20} strokeWidth={1.75} aria-hidden="true" />}
            title={search ? 'No Matches' : 'No Teammates Yet'}
            body={search ? 'Try another name' : 'Your team will appear here'}
          />
        ) : (
          ['Rowers', 'Coxswains & Staff'].map((section) => {
            const rows = users.filter((u) => (u.role === 'rower') === (section === 'Rowers'));
            return (
              rows.length > 0 && (
                <ListGroup key={section} header={section}>
                  {rows.map((u) => (
                    <ListRow
                      key={u.id}
                      title={u.name}
                      subtitle={publicSubtitle(u)}
                      avatar={<Avatar name={u.name} imageId={u.avatar_image_id} />}
                      to={`/users/${u.id}`}
                    />
                  ))}
                </ListGroup>
              )
            );
          })
        )}
      </div>
    </>
  );
}
