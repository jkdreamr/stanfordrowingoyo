import { LockKeyhole } from 'lucide-react';
import { Button, EmptyState } from '../components/ui';

export function GameLocked() {
  return (
    <EmptyState
      icon={<LockKeyhole size={20} strokeWidth={1.75} />}
      title="Games Locked"
      body="Log a workout today to play"
      action={<Button to="/log">Log a Workout</Button>}
    />
  );
}
