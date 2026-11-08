import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DiveDay, DiveReveal, DiveRevealGroup } from '../../../../shared/types';
import { DIVE_TIERS } from '../../../../shared/games/dive';
import { Button, ConfirmSheet } from '../../components/ui';
import { api } from '../../lib/api';
import { qk } from '../../lib/queries';
import { GameDayBoard } from '../GameDayBoard';

export function Results({
  day,
  staff,
  reviewOnly = false,
}: {
  day: DiveDay;
  staff: boolean;
  reviewOnly?: boolean;
}) {
  const client = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [target, setTarget] = useState<{ prompt: DiveReveal; group: DiveRevealGroup } | null>(null);
  const moderation = useMutation({
    mutationFn: () =>
      api('PATCH /api/games/dive/answers', {
        body: {
          date: day.date,
          prompt_index: target!.prompt.prompt_index,
          normalized: target!.group.normalized,
          hidden: !target!.group.hidden,
        },
      }),
    onSuccess: async () => {
      setTarget(null);
      await client.invalidateQueries({ queryKey: qk.root('games') });
    },
  });
  return (
    <div className="space-y-8">
      {!reviewOnly && (
        <section aria-label="Dive Log">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-title2">Your Dive</h2>
              <p className="mt-1 text-callout text-muted">{day.verdict}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                setCopyError(false);
                try {
                  const grid = [...day.answers]
                    .sort((a, b) => a.prompt_index - b.prompt_index)
                    .map((answer) => DIVE_TIERS[answer.tier].emoji)
                    .join('');
                  await navigator.clipboard.writeText(`Dive ${day.date} · ${day.score} m\n${grid}`);
                  setCopied(true);
                } catch {
                  setCopyError(true);
                }
              }}
            >
              {copied ? 'Copied' : 'Copy Result'}
            </Button>
          </div>
          {copyError && (
            <p role="alert" className="mb-4 text-subhead text-muted">
              Couldn’t copy. Try again.
            </p>
          )}
          <ol className="dive-log">
            {day.answers.map((answer) => (
              <li key={answer.prompt_index}>
                <div className="min-w-0 flex-1">
                  <p className="text-subhead font-medium">{day.prompts[answer.prompt_index]}</p>
                  <p className="mt-1 break-words text-subhead text-muted">
                    {answer.canonical ?? 'Not On The List'} · {DIVE_TIERS[answer.tier].label}
                  </p>
                  {answer.hidden && (
                    <p className="mt-1 text-footnote text-muted">Hidden From Team</p>
                  )}
                </div>
                <span className="shrink-0 text-subhead tabular-nums">{answer.points} m</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className="dive-answer-groups" aria-label="Team Answers">
        <h2 className="mb-3 text-title2">Team Answers</h2>
        {day.reveal?.map((prompt) => (
          <details key={prompt.prompt_index} open={prompt.prompt_index === 0}>
            <summary className="text-subhead">{prompt.prompt}</summary>
            <div className="space-y-1 pb-4">
              {prompt.groups.length ? (
                prompt.groups.map((group) => (
                  <div
                    key={group.normalized}
                    className={`dive-group ${group.mine ? 'dive-group-mine' : ''}`}
                  >
                    <div className="dive-group-text">
                      <p className="text-callout">
                        {group.answer}
                        {group.mine && <span className="text-subhead text-muted"> · You</span>}
                      </p>
                      <p className="mt-1 text-footnote text-muted">
                        {DIVE_TIERS[group.tier].label}
                        {group.hidden && ' · Hidden From Team'}
                      </p>
                      <p className="mt-1 text-subhead text-muted">
                        {group.teammates.map((teammate) => teammate.name).join(', ')}
                      </p>
                      {group.only_you && <span className="dive-only-you">Only You</span>}
                    </div>
                    <span className="shrink-0 text-subhead tabular-nums">{group.points} m</span>
                    {staff && (
                      <Button
                        variant="plain"
                        size="sm"
                        aria-label={`${group.hidden ? 'Unhide' : 'Hide'} ${group.answer}`}
                        onClick={() => {
                          moderation.reset();
                          setTarget({ prompt, group });
                        }}
                      >
                        {group.hidden ? 'Unhide' : 'Hide'}
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <p className="px-4 pb-2 text-subhead text-muted">No Answers</p>
              )}
            </div>
          </details>
        ))}
      </section>
      <GameDayBoard gameId="dive" date={day.date} />
      <ConfirmSheet
        open={!!target}
        onClose={() => setTarget(null)}
        title={target?.group.hidden ? 'Unhide Answer?' : 'Hide Answer?'}
        body={
          moderation.error?.message ??
          (target?.group.hidden
            ? 'Restore This Answer To Team View. Scores Stay The Same.'
            : 'Hide This Answer From Team View. Scores Stay The Same.')
        }
        confirmLabel={target?.group.hidden ? 'Unhide Answer' : 'Hide Answer'}
        cancelLabel="Cancel"
        loading={moderation.isPending}
        onConfirm={() => moderation.mutate()}
      />
    </div>
  );
}
