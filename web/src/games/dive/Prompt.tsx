import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { DiveAnswerResult, DivePending } from '../../../../shared/types';
import { Button, TextField } from '../../components/ui';
import { api, ApiClientError } from '../../lib/api';
import {
  DIVE_MAX_WRONG_GUESSES,
  DIVE_PROMPT_MS,
  DIVE_PROMPTS_PER_DAY,
} from '../../../../shared/games/dive';

type Submission = { kind: 'guess'; value: string } | { kind: 'suggestion'; accept: boolean };
function isConflict(error: unknown) {
  return error instanceof ApiClientError && error.status === 409;
}
function isTooFast(error: unknown) {
  return error instanceof ApiClientError && error.detail.code === 'TOO_FAST';
}

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
  pending,
  onSaved,
  onConflict,
}: {
  prompt: string;
  index: number;
  storageKey: string;
  pending?: DivePending | null;
  onSaved: (answer: DiveAnswerResult) => void;
  onConflict: () => Promise<unknown>;
}) {
  const [deadline, setDeadline] = useState(() =>
    pending
      ? Date.now() + pending.deadline_ms_remaining
      : (savedDeadline(storageKey) ?? Date.now() + DIVE_PROMPT_MS),
  );
  const deadlineRef = useRef(deadline);
  const form = useRef<HTMLFormElement>(null);
  const locked = useRef(false);
  const submittedText = useRef('');
  const finished = useRef(false);
  const timeoutSent = useRef(false);
  const [started, setStarted] = useState(false);
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()));
  const [answer, setAnswer] = useState('');
  const [suggestion, setSuggestion] = useState(() =>
    pending?.suggestion ? { canonical: pending.suggestion, typed: '' } : null,
  );
  const [attemptsLeft, setAttemptsLeft] = useState(
    pending?.attempts_left ?? DIVE_MAX_WRONG_GUESSES,
  );
  const [feedback, setFeedback] = useState(false);
  const [shake, setShake] = useState(false);
  const focusInput = () => form.current?.querySelector('input')?.focus({ preventScroll: true });
  const wrongAnswer = (left: number) => {
    setAttemptsLeft(left);
    if (form.current?.querySelector('input')?.value === submittedText.current) setAnswer('');
    setSuggestion(null);
    setFeedback(true);
    setShake(true);
    focusInput();
  };
  const startMutation = useMutation({
    mutationFn: () => api('POST /api/games/dive/start', { body: { prompt_index: index } }),
    onSuccess: (response) => {
      const value = Date.now() + response.deadline_ms_remaining;
      deadlineRef.current = value;
      setDeadline(value);
      setRemaining(response.deadline_ms_remaining);
      setStarted(true);
      try {
        localStorage.setItem(storageKey, String(value));
      } catch {
        /* The in-memory deadline still applies. */
      }
    },
    onError: async (error) => {
      if (isConflict(error)) await onConflict();
    },
  });
  const begin = startMutation.mutate;
  useEffect(() => {
    begin();
  }, [begin]);
  const mutation = useMutation({
    mutationFn: (submission: Submission) =>
      submission.kind === 'suggestion'
        ? api('POST /api/games/dive/suggestion', {
            body: { prompt_index: index, accept: submission.accept },
          })
        : api('POST /api/games/dive/guesses', {
            body: { prompt_index: index, answer: submission.value },
          }),
    onSuccess: (response, submission) => {
      if (response.outcome === 'scored') {
        finished.current = true;
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* Storage may be unavailable. */
        }
        onSaved(response.answer);
      } else if (response.outcome === 'suggestion') {
        setAttemptsLeft(response.attempts_left);
        setFeedback(false);
        if (
          submission.kind === 'guess' &&
          form.current?.querySelector('input')?.value.trim() === submission.value
        )
          setSuggestion({ canonical: response.suggestion, typed: submission.value });
        const value = Date.now() + response.deadline_ms_remaining;
        deadlineRef.current = value;
        setDeadline(value);
        setRemaining(response.deadline_ms_remaining);
        focusInput();
      } else wrongAnswer(response.attempts_left);
    },
    onError: async (error) => {
      if (isConflict(error)) await onConflict();
    },
    onSettled: () => {
      locked.current = false;
    },
  });
  const mutate = mutation.mutate;
  const send = useCallback(
    (submission: Submission) => {
      if (locked.current || finished.current) return;
      locked.current = true;
      submittedText.current = form.current?.querySelector('input')?.value ?? '';
      if (Date.now() >= deadlineRef.current) {
        timeoutSent.current = true;
        mutate({ kind: 'guess', value: '' });
      } else mutate(submission);
    },
    [mutate],
  );
  useEffect(() => {
    if (!started) return;
    function tick() {
      const time = Math.max(0, deadline - Date.now());
      setRemaining(time);
      if (time === 0 && !timeoutSent.current && !locked.current && !finished.current)
        send({ kind: 'guess', value: '' });
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
  }, [deadline, started, send]);
  useEffect(() => {
    if (!shake) return;
    const timer = setTimeout(() => setShake(false), 280);
    return () => clearTimeout(timer);
  }, [shake]);
  const error =
    startMutation.error ??
    (isTooFast(mutation.error) || isConflict(mutation.error) ? null : mutation.error);
  return (
    <form
      ref={form}
      className="dive-prompt space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        focusInput();
        if (!started) {
          if (!startMutation.isPending) begin();
          return;
        }
        if (suggestion && answer.trim() === suggestion.typed)
          send({ kind: 'suggestion', accept: true });
        else send({ kind: 'guess', value: answer.trim() });
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-subhead text-muted">
          {index + 1} of {DIVE_PROMPTS_PER_DAY}
        </p>
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
              strokeDashoffset={
                2 * Math.PI * 24 * (1 - Math.min(remaining, DIVE_PROMPT_MS) / DIVE_PROMPT_MS)
              }
            />
          </svg>
          <span className="dive-timer-value" aria-hidden="true">
            {Math.ceil(remaining / 1000)}
          </span>
        </div>
      </div>
      <div className="dive-steps" aria-hidden="true">
        {Array.from({ length: DIVE_PROMPTS_PER_DAY }, (_, i) => (
          <span
            key={i}
            className={`dive-step ${i < index ? 'dive-step-done' : i === index ? 'dive-step-current' : ''}`}
          />
        ))}
      </div>
      <h2 className="dive-prompt-title text-title2" tabIndex={-1}>
        {prompt}
      </h2>
      <div className="dive-answer-area">
        <div className={shake ? 'dive-input-shake' : undefined}>
          <TextField
            label="Your Answer"
            value={answer}
            maxLength={60}
            autoComplete="off"
            autoCapitalize="sentences"
            autoFocus
            readOnly={started && remaining === 0}
            onChange={(event) => {
              setAnswer(event.target.value);
              setFeedback(false);
              setShake(false);
              setSuggestion(null);
              if (!locked.current) mutation.reset();
            }}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.nativeEvent.isComposing &&
                suggestion &&
                answer.trim() === suggestion.typed
              ) {
                event.preventDefault();
                if (started) send({ kind: 'suggestion', accept: true });
              }
              if (event.key === 'Escape' && suggestion) {
                event.preventDefault();
                if (started) send({ kind: 'suggestion', accept: false });
              }
            }}
            error={error && !isConflict(error) ? error.message : undefined}
          />
        </div>
        <div className={suggestion ? 'dive-suggestion' : 'dive-feedback'}>
          <div role="status" aria-live="polite" aria-atomic="true">
            {suggestion && (
              <p>
                Did you mean <strong>{suggestion.canonical}</strong>?
              </p>
            )}
            {feedback && <p className="dive-wrong-feedback">Not an answer</p>}
            {attemptsLeft <= 5 && (
              <p className="text-footnote text-muted">
                {attemptsLeft} {attemptsLeft === 1 ? 'guess' : 'guesses'} left
              </p>
            )}
          </div>
          {suggestion && (
            <div className="dive-suggestion-actions">
              <Button
                disabled={!started || mutation.isPending || remaining === 0}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  focusInput();
                  send({ kind: 'suggestion', accept: true });
                }}
              >
                Yes
              </Button>
              <Button
                variant="secondary"
                disabled={!started || mutation.isPending || remaining === 0}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  focusInput();
                  send({ kind: 'suggestion', accept: false });
                }}
              >
                No
              </Button>
            </div>
          )}
        </div>
      </div>
      {(!suggestion || !!error) && (
        <Button
          type="submit"
          fullWidth
          loading={mutation.isPending || startMutation.isPending}
          onPointerDown={(event) => event.preventDefault()}
          disabled={
            (!started && !startMutation.isError) ||
            (!answer.trim() && remaining > 0 && !startMutation.isError)
          }
        >
          {error ? 'Retry' : remaining === 0 ? 'Time’s Up' : 'Dive'}
        </Button>
      )}
    </form>
  );
}
