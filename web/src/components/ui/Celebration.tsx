import { useEffect, useState } from 'react';
import { Flame, Trophy, X } from 'lucide-react';
import type { User } from '../../../../shared/types';
import { clearCelebration, pendingCelebration, type Achievement } from '../../lib/celebrations';
import { formatEMeters, formatSplit } from '../../lib/format';
import { useUpdateMe } from '../../lib/queries';
import { Button } from './Button';
import { Card } from './Card';
import { IconButton } from './IconButton';
import { useToast } from './Toast';

export function Celebration({ user }: { user: User }) {
  const [achievement, setAchievement] = useState(() => pendingCelebration(user.id));
  const split = achievement?.kind === 'split-2k' || achievement?.kind === 'split-6k';
  useEffect(() => {
    clearCelebration(user.id);
  }, [user.id]);
  useEffect(() => {
    if (!achievement || split) return;
    const timer = setTimeout(() => setAchievement(undefined), 5000);
    return () => clearTimeout(timer);
  }, [achievement, split]);
  if (!achievement) return null;
  return <CelebrationCard achievement={achievement} onDismiss={() => setAchievement(undefined)} />;
}

function CelebrationCard({
  achievement,
  onDismiss,
}: {
  achievement: Achievement;
  onDismiss: () => void;
}) {
  const mutation = useUpdateMe();
  const toast = useToast();
  const split = achievement.kind === 'split-2k' || achievement.kind === 'split-6k';
  const streak = achievement.kind === 'streak' || achievement.kind === 'longest-streak';
  const Icon = streak ? Flame : Trophy;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const value = split
    ? `${formatSplit(achievement.value)} /500m`
    : streak
      ? `${achievement.value} Weeks`
      : `${formatEMeters(achievement.value, true)} m`;
  return (
    <Card className={`flex items-start gap-3 ${reduced ? '' : 'celebration-pop'}`}>
      <Icon
        size={24}
        strokeWidth={1.75}
        aria-hidden="true"
        className="mt-1 shrink-0 text-highlight dark:text-highlight-ink"
      />
      <div className="min-w-0 flex-1">
        <div role="status" aria-live="polite" aria-atomic="true">
          <h2 className="text-headline">{achievement.title}</h2>
          <p className="mt-1 text-title3 tabular-nums">{value}</p>
        </div>
        {split && (
          <Button
            className="mt-3"
            loading={mutation.isPending}
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate(
                {
                  body: {
                    [achievement.kind === 'split-2k' ? 'best2k_split_s' : 'best6k_split_s']:
                      achievement.value,
                  },
                },
                {
                  onSuccess: onDismiss,
                  onError: () => toast.show({ title: 'Best not saved. Try again', tone: 'error' }),
                },
              )
            }
          >
            Save as Best
          </Button>
        )}
      </div>
      <IconButton className="!text-accent-ink" aria-label="Dismiss Celebration" onClick={onDismiss}>
        <X size={20} strokeWidth={1.75} />
      </IconButton>
    </Card>
  );
}
