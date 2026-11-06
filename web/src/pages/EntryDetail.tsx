import { Placeholder } from '../components/shell/Placeholder';
import { Button } from '../components/ui';
import { useParams } from 'react-router-dom';
import { useEntry, useMe } from '../lib/queries';
export default function Page() {
  const { id = '' } = useParams();
  const { data: entry } = useEntry(id);
  const { data: user } = useMe();
  return (
    <Placeholder title="Session">
      {entry && user && entry.user_id === user.id && (
        <div className="mt-6">
          <Button to={`/log?edit=${encodeURIComponent(entry.id)}`}>Edit Session</Button>
        </div>
      )}
    </Placeholder>
  );
}
