import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { DiveAnswerResult } from '../../../../shared/types';
import { Button, TextField } from '../../components/ui';
import { api, ApiClientError } from '../../lib/api';

export function deadlineKey(userId: string, date: string, index: number) {
  return `oyo:dive:${userId}:${date}:${index}`;
}
export function savedDeadline(key: string): number | null {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}
export function Prompt({
  prompt,
  index,
  storageKey,
  onSaved,
  onConflict,
}: {
  prompt: string;
  index: number;
  storageKey: string;
  onSaved: (answer: DiveAnswerResult) => void;
  onConflict: () => Promise<unknown>;
}) {
  const [deadline] = useState(() => {
    const value = savedDeadline(storageKey) ?? Date.now() + 25000;
    try {
      localStorage.setItem(storageKey, String(value));
    } catch {
      /* The in-memory deadline still applies. */
    }
    return value;
  });
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()));
  const [answer, setAnswer] = useState('');
  const attempted = useRef(false);
  const mutation = useMutation({
    mutationFn: (value: string) =>
      api('POST /api/games/dive/answers', { body: { prompt_index: index, answer: value } }),
    onSuccess: onSaved,
    onError: async (error) => {
      if (Date.now() < deadline) attempted.current = false;
      if (
        error instanceof ApiClientError &&
        ['ALREADY_ANSWERED', 'OUT_OF_ORDER'].includes(error.detail.code)
      )
        await onConflict();
    },
  });
  const mutate = mutation.mutate;
  useEffect(() => {
    function tick() {
      const time = Math.max(0, deadline - Date.now());
      setRemaining(time);
      if (time === 0 && !attempted.current) {
        attempted.current = true;
        mutate('');
      }
    }
    tick();
    const timer = setInterval(tick, 200);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('pageshow', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('pageshow', tick);
    };
  }, [deadline, mutate]);
  return (
    <form
      className="dive-prompt space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (mutation.isPending) return;
        attempted.current = true;
        mutate(Date.now() >= deadline ? '' : answer.trim());
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-subhead text-muted">Prompt {index + 1} Of 7</p>
        <div
          className="dive-timer"
          role="timer"
          aria-label={`${Math.ceil(remaining / 1000)} Seconds Left`}
        >
          <svg viewBox="0 0 56 56" aria-hidden="true">
            <circle cx="28" cy="28" r="24" />
            <circle
              className="dive-timer-progress"
              cx="28"
              cy="28"
              r="24"
              strokeDasharray={2 * Math.PI * 24}
              strokeDashoffset={2 * Math.PI * 24 * (1 - remaining / 25000)}
            />
          </svg>
          <span className="dive-timer-value" aria-hidden="true">
            {Math.ceil(remaining / 1000)}
          </span>
        </div>
      </div>
      <div className="dive-steps" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            className={`dive-step ${i < index ? 'dive-step-done' : i === index ? 'dive-step-current' : ''}`}
          />
        ))}
      </div>
      <h2 className="dive-prompt-title text-title2" tabIndex={-1}>
        {prompt}
      </h2>
      <TextField
        label="Your Answer"
        value={answer}
        maxLength={40}
        autoComplete="off"
        autoCapitalize="sentences"
        disabled={mutation.isPending || remaining === 0}
        onChange={(event) => setAnswer(event.target.value)}
        error={mutation.error ? mutation.error.message : undefined}
      />
      <Button
        type="submit"
        fullWidth
        loading={mutation.isPending}
        disabled={!answer.trim() && remaining > 0}
      >
        {mutation.isError ? 'Retry' : remaining === 0 ? 'Time’s Up' : 'Dive'}
      </Button>
    </form>
  );
}
