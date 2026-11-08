import { Waves } from 'lucide-react';
import { LoadState } from '../components/shell/LoadState';
import { useGameAccess } from './useGameAccess';
import { GameLocked } from './GameLocked';

export default function DiveStart() {
  const access = useGameAccess();
  if (!access.data) return <LoadState error={access.isError} retry={() => void access.refetch()} />;
  if (!access.data.unlocked) return <GameLocked />;
  return (
    <div className="py-12 text-center">
      <Waves
        aria-hidden="true"
        size={48}
        strokeWidth={1.25}
        className="mx-auto mb-5 text-accent-ink"
      />
      <h2 className="text-title2">Dive</h2>
      <p className="mt-2 text-subhead text-muted">{access.data.date}</p>
    </div>
  );
}
