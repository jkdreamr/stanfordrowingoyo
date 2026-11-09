import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Volume2, VolumeX } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { sfx, useSound } from './sfx';
import type { ArcadePlayProps, ArcadeRunResult } from './types';
import './arcade-stage.css';

export interface ArcadeStageProps<S> {
  seed: number;
  onGameOver(result: ArcadeRunResult<S>): void;
  children(props: ArcadePlayProps<S>): ReactNode;
}
export function ArcadeStage<S>({ seed, onGameOver, children }: ArcadeStageProps<S>) {
  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [paused, setPaused] = useState(() => document.hidden);
  const [ended, setEnded] = useState(false);
  const [endRequested, setEndRequested] = useState(false);
  const [score, setScore] = useState(0);
  const [sound, setSound] = useSound();
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const complete = useRef(false);
  const notify = useRef(onGameOver);
  notify.current = onGameOver;
  const gameOver = useCallback((result: ArcadeRunResult<S>) => {
    if (complete.current) return;
    complete.current = true;
    setEnded(true);
    setPaused(false);
    sfx.suspend();
    notify.current(result);
  }, []);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const elements = [document.documentElement, document.body];
    const overflowProperties = ['overflow', 'overflow-x', 'overflow-y'];
    const overflow = elements.map((el) =>
      Array.from(el.style)
        .filter((name) => overflowProperties.includes(name))
        .map((name) => [name, el.style.getPropertyValue(name), el.style.getPropertyPriority(name)]),
    );
    elements.forEach((el) => el.style.setProperty('overflow', 'hidden'));
    root.current?.focus();
    const pause = () => {
      if (!complete.current) setPaused(true);
      sfx.suspend();
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    const prevent = (event: Event) => event.preventDefault();
    const key = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat ||
        (event.target instanceof Element &&
          event.target.closest('input,textarea,select,[contenteditable]'))
      )
        return;
      if (event.code === 'Escape' || event.code === 'KeyP') {
        event.preventDefault();
        if (!complete.current) setPaused((value) => !value);
      }
    };
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReducedMotion(media.matches);
    media.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('gesturestart', prevent, { passive: false });
    document.addEventListener('gesturechange', prevent, { passive: false });
    window.addEventListener('blur', pause);
    window.addEventListener('pagehide', pause);
    window.addEventListener('keydown', key);
    return () => {
      media.removeEventListener('change', motion);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('gesturestart', prevent);
      document.removeEventListener('gesturechange', prevent);
      window.removeEventListener('blur', pause);
      window.removeEventListener('pagehide', pause);
      window.removeEventListener('keydown', key);
      elements.forEach((el, i) => {
        overflowProperties.forEach((name) => el.style.removeProperty(name));
        overflow[i].forEach(([name, value, priority]) =>
          el.style.setProperty(name, value, priority),
        );
      });
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  useEffect(() => {
    if (paused && !ended && !endRequested) {
      sfx.suspend();
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      root.current?.focus();
    }
  }, [paused, ended, endRequested]);
  const resume = () => {
    sfx.unlock();
    setPaused(false);
  };
  return createPortal(
    <div
      ref={root}
      className="arcade-stage"
      tabIndex={-1}
      data-no-tab-swipe
      aria-label="Arcade Game"
      onDoubleClick={(e) => e.preventDefault()}
      onPointerDownCapture={() => {
        if (!paused && !ended) sfx.unlock();
      }}
      onKeyDownCapture={(e) => {
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !paused && !ended) sfx.unlock();
      }}
    >
      <div className="arcade-stage-game" aria-hidden={paused || undefined}>
        {children({
          seed,
          paused: paused || ended,
          sound,
          reducedMotion,
          setScore,
          onGameOver: gameOver,
          endRequested,
        })}
      </div>
      <header className="arcade-stage-bar">
        <IconButton
          aria-label="Pause"
          onClick={() => setPaused(true)}
          disabled={ended || endRequested}
        >
          <Pause size={20} />
        </IconButton>
        <span className="arcade-stage-score" aria-live="off">
          {score.toLocaleString()}
        </span>
        <IconButton
          aria-label="Sound"
          aria-pressed={sound}
          onClick={() => {
            setSound(!sound);
            if (!sound) sfx.unlock();
          }}
        >
          {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </IconButton>
      </header>
      <dialog
        ref={dialog}
        className="arcade-stage-pause"
        aria-labelledby="arcade-pause-title"
        onCancel={(e) => {
          e.preventDefault();
          setPaused(false);
        }}
      >
        <h2 id="arcade-pause-title">Paused</h2>
        <Button onClick={resume}>Resume</Button>
        <Button
          variant="secondary"
          onClick={() => {
            setEndRequested(true);
            setPaused(false);
          }}
        >
          End Run
        </Button>
      </dialog>
    </div>,
    document.body,
  );
}
