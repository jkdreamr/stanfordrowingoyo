import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CUED_STROKES,
  PIECES,
  STROKES_PER_PIECE,
  heldRate,
  intervalMs,
  rateHoldRates,
  scorePiece,
} from '../../../../shared/games/rateHold';
import { Button } from '../../components/ui';
import type { PlayProps } from '../DailyGameFrame';
import './ratehold.css';

export interface RateHoldPayload {
  taps: number[][];
}

type Stage = 'ready' | 'rowing' | 'reveal';

export function RateHoldPlay({ date, onComplete }: PlayProps<RateHoldPayload>) {
  const rates = useMemo(() => rateHoldRates(date), [date]);
  const [piece, setPiece] = useState(0);
  const [stage, setStage] = useState<Stage>('ready');
  const [taps, setTaps] = useState<number[]>([]);
  const [beat, setBeat] = useState(0);
  const all = useRef<number[][]>([]);
  const startedAt = useRef(0);
  const rate = rates[piece];
  const cueing = stage === 'rowing' && taps.length < CUED_STROKES;
  const last = piece === PIECES - 1;

  useEffect(() => {
    if (!cueing) return;
    const every = intervalMs(rate);
    const elapsed = performance.now() - startedAt.current;
    let n = Math.floor(elapsed / every) + 1;
    let timer = 0;
    const tick = () => {
      setBeat(n);
      navigator.vibrate?.(8);
      n += 1;
      timer = window.setTimeout(tick, startedAt.current + n * every - performance.now());
    };
    timer = window.setTimeout(tick, startedAt.current + n * every - performance.now());
    return () => window.clearTimeout(timer);
  }, [cueing, rate]);

  const start = () => {
    startedAt.current = performance.now();
    setTaps([]);
    setBeat(0);
    setStage('rowing');
  };

  const catchStroke = () => {
    if (stage !== 'rowing') return;
    const t = Math.round(performance.now() - startedAt.current);
    if (taps.length && t - taps[taps.length - 1] < 300) return;
    const next = [...taps, t];
    setTaps(next);
    if (next.length === STROKES_PER_PIECE) {
      all.current[piece] = next;
      setStage('reveal');
    }
  };

  const advance = () => {
    if (last) onComplete({ taps: all.current });
    else {
      setPiece((p) => p + 1);
      setTaps([]);
      setStage('ready');
    }
  };

  const status =
    stage === 'ready' ? 'Ready' : stage === 'reveal' ? 'Easy' : cueing ? 'Follow' : 'Hold the Rate';

  return (
    <div className="rh">
      <div className="rh-head">
        <div>
          <p className="text-subhead text-muted">
            Piece {piece + 1} of {PIECES}
          </p>
          <p className="rh-rate tabular-nums">
            {rate}
            <span className="text-headline text-muted"> spm</span>
          </p>
        </div>
        <ol className="rh-pieces" aria-label="Pieces">
          {rates.map((r, i) => (
            <li
              key={i}
              className={
                i < piece || (i === piece && stage === 'reveal')
                  ? 'rh-piece-done'
                  : i === piece
                    ? 'rh-piece-now'
                    : ''
              }
            >
              {r}
            </li>
          ))}
        </ol>
      </div>
      <button
        type="button"
        className={'rh-pad' + (cueing ? ' rh-pad-cue' : '')}
        disabled={stage !== 'rowing'}
        onPointerDown={(e) => {
          e.preventDefault();
          catchStroke();
        }}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            catchStroke();
          }
        }}
        aria-label="Catch"
        data-testid="catch-pad"
      >
        {cueing && (
          <span
            key={beat}
            className="rh-beat"
            style={{ animationDuration: `${intervalMs(rate)}ms` }}
            aria-hidden="true"
          />
        )}
        <span className="rh-pad-label">
          {stage === 'reveal' ? <PieceResult rate={rate} taps={taps} /> : status}
        </span>
      </button>
      <ol className="rh-strokes" aria-label={`${taps.length} of ${STROKES_PER_PIECE} strokes`}>
        {Array.from({ length: STROKES_PER_PIECE }, (_, i) => (
          <li
            key={i}
            className={
              (i < CUED_STROKES ? 'rh-stroke-cued' : '') +
              (i < taps.length ? ' rh-stroke-done' : '')
            }
          />
        ))}
      </ol>
      {stage === 'ready' && (
        <Button fullWidth size="lg" onClick={start} autoFocus>
          Start Piece
        </Button>
      )}
      {stage === 'reveal' && (
        <Button fullWidth size="lg" onClick={advance} autoFocus>
          {last ? 'See Result' : 'Next Piece'}
        </Button>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {stage === 'rowing' ? status : ''}
      </p>
    </div>
  );
}

function PieceResult({ rate, taps }: { rate: number; taps: number[] }) {
  return (
    <span className="rh-result tabular-nums" role="status">
      <span className="text-title1">{heldRate(taps).toFixed(1)}</span>
      <span className="text-subhead text-muted">
        Target {rate} · {scorePiece(rate, taps)} / 100
      </span>
    </span>
  );
}
