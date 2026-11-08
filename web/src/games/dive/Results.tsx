import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DiveDay, DiveReveal, DiveRevealGroup } from '../../../../shared/types';
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
            <h2 className="text-title2">Your Dive</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                setCopyError(false);
                try {
                  await navigator.clipboard.writeText(`Dive ${day.date} · ${day.score} m`);
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
                    {answer.answer || 'No Answer'} · {answer.tier}
                  </p>
                </div>
                <span className="shrink-0 text-subhead tabular-nums">{answer.points} m</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className="dive-answer-groups" aria-label="Today's Answers">
        <h2 className="mb-3 text-title2">Today’s Answers</h2>
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
                        {group.tier}
                        {!group.hidden &&
                          ` · ${group.count} ${group.count === 1 ? 'Answer' : 'Answers'}`}
                      </p>
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
            ? 'Restore this answer and its points for everyone.'
            : 'Hide this answer and remove its points for everyone.')
        }
        confirmLabel={target?.group.hidden ? 'Unhide Answer' : 'Hide Answer'}
        cancelLabel="Cancel"
        loading={moderation.isPending}
        onConfirm={() => moderation.mutate()}
      />
    </div>
  );
}
