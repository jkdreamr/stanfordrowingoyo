import { useEffect, useRef, useState } from 'react';
import { Flame, Trophy, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '../../../../shared/types';
import { clearCelebration, pendingCelebration, type Achievement } from '../../lib/celebrations';
import { formatEMeters, formatSplit } from '../../lib/format';
import { invalidationKeys, useCreateErgTest } from '../../lib/queries';
import { saveCelebrationTest } from '../../lib/celebrationTests';
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
  return (
    <CelebrationCard
      user={user.id}
      achievement={achievement}
      onDismiss={() => setAchievement(undefined)}
    />
  );
}

function CelebrationCard({
  user,
  achievement,
  onDismiss,
}: {
  user: string;
  achievement: Achievement;
  onDismiss: () => void;
}) {
  const mutation = useCreateErgTest();
  const client = useQueryClient();
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const split = achievement.kind === 'split-2k' || achievement.kind === 'split-6k';
  const streak = achievement.kind === 'streak' || achievement.kind === 'longest-streak';
  const Icon = streak ? Flame : Trophy;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      const created = await saveCelebrationTest(user, achievement, mutation.mutateAsync);
      if (!created)
        await Promise.all(
          invalidationKeys('POST /api/me/tests').map((queryKey) =>
            client.invalidateQueries({ queryKey }),
          ),
        );
      onDismiss();
    } catch {
      toast.show({ title: 'Best not saved. Try again', tone: 'error' });
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
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
          <Button className="mt-3" loading={busy} disabled={busy} onClick={() => void save()}>
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
