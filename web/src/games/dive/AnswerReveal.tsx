import { DIVE_TIERS } from '../../../../shared/games/dive';
import type { DiveAnswerResult } from '../../../../shared/types';
import { Button } from '../../components/ui';

export function AnswerReveal({
  answer,
  busy,
  onContinue,
}: {
  answer: DiveAnswerResult;
  busy: boolean;
  onContinue: () => void;
}) {
  const available = answer.notable.filter(
    (item) => item.answer !== answer.gem.answer && item.answer !== answer.canonical,
  );
  const first = available[0];
  const second = available.find((item) => item !== first && item.tier === 'deep') ?? available[1];
  const notable = [first, second].filter((item) => item !== undefined);
  return (
    <section className="dive-reveal space-y-5" aria-label="Answer Result" aria-live="polite">
      <p className="text-subhead text-muted">{answer.prompt_index + 1} of 7</p>
      <div className={answer.tier === 'tooclever' ? 'dive-clever-callout' : undefined}>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-title1">{DIVE_TIERS[answer.tier].label}</h2>
          <p className="shrink-0 text-title2 tabular-nums">+{answer.points} m</p>
        </div>
        <p className="mt-2 break-words text-title3">{answer.canonical ?? 'Not On The List'}</p>
        {answer.tier === 'tooclever' && (
          <p className="mt-2 text-subhead text-muted">The Secret’s Out</p>
        )}
      </div>
      <div className="dive-answer-notes">
        <div>
          <h3 className="text-headline">Pearl</h3>
          <p className="mt-1 flex justify-between gap-4 text-callout">
            <span className="min-w-0 flex-1 break-words">{answer.gem.answer}</span>
            <span className="shrink-0 text-muted tabular-nums">100 m</span>
          </p>
        </div>
        {notable.length > 0 && (
          <div>
            <h3 className="text-headline">Also On The List</h3>
            <ul className="mt-1 space-y-2">
              {notable.map((item) => (
                <li key={item.answer} className="flex justify-between gap-4 text-subhead">
                  <span className="min-w-0 flex-1 break-words">{item.answer}</span>
                  <span className="shrink-0 text-muted tabular-nums">
                    {DIVE_TIERS[item.tier].label} · {item.points} m
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Button fullWidth disabled={busy} onClick={onContinue}>
        Continue
      </Button>
    </section>
  );
}
