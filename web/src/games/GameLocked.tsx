import { LockKeyhole } from 'lucide-react';
import { Button, EmptyState } from '../components/ui';

export function GameLocked() {
  return (
    <EmptyState
      icon={<LockKeyhole size={20} strokeWidth={1.75} />}
      title="Log today's OYO to unlock"
      action={<Button to="/log">Log Workout</Button>}
    />
  );
}
