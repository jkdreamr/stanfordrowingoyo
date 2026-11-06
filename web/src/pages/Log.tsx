import { Activity } from 'lucide-react';
import { Button, EmptyState, PageHeader } from '../components/ui';
export default function Page() {
  return (
    <>
      <PageHeader
        title="Log Session"
        trailing={
          <Button to="/" variant="plain">
            Cancel
          </Button>
        }
      />
      <EmptyState
        icon={<Activity size={20} strokeWidth={1.75} />}
        title="Session Logging Is Coming"
        body="Your training entry form is being built"
      />
    </>
  );
}
