// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ArcadeStage } from './ArcadeStage';
import { useGameLoop } from './loop';
import { KeyState, useKeys } from './keys';
import { sfx } from './sfx';
import { useGestures } from './gestures';
import { useCanvas } from './canvas';
import type { ArcadePlayProps } from './types';

let frames: Map<number, FrameRequestCallback>;
let sequence = 0;
const update = vi.fn();
const paint = vi.fn();
const audio = vi.fn();
const suspend = vi.fn(() => Promise.resolve());
const close = vi.fn(() => Promise.resolve());
const resume = vi.fn(() => Promise.resolve());
Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: { configurable: true, writable: true, value() {} },
  close: { configurable: true, writable: true, value() {} },
});
beforeEach(() => {
  frames = new Map();
  localStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      frames.set(++sequence, callback);
      return sequence;
    }),
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => frames.delete(id)),
  );
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute('open', '');
  });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (
    this: HTMLDialogElement,
  ) {
    this.removeAttribute('open');
  });
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        audio();
      }
      state = 'running';
      suspend = suspend;
      resume = resume;
      close = close;
    },
  );
});
afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('overflow');
  document.body.style.removeProperty('overflow');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function tick(now: number) {
  act(() => {
    const batch = [...frames.values()];
    frames.clear();
    batch.forEach((fn) => fn(now));
  });
}
function Probe(props: ArcadePlayProps<unknown>) {
  useGameLoop(update, paint, { running: !props.paused });
  useKeys(undefined, !props.paused);
  return (
    <output data-testid="state">
      {JSON.stringify({ paused: props.paused, sound: props.sound, end: props.endRequested })}
    </output>
  );
}
function mount() {
  return render(
    <ArcadeStage seed={42} onGameOver={vi.fn()}>
      {(props) => <Probe {...props} />}
    </ArcadeStage>,
  );
}
it('locks both scroll containers, restores exact values/priorities and focus', () => {
  document.body.style.setProperty('overflow', 'scroll', 'important');
  document.documentElement.style.setProperty('overflow-x', 'auto', 'important');
  document.documentElement.style.overflowY = 'scroll';
  const original = document.documentElement.style.cssText;
  const before = document.createElement('button');
  document.body.append(before);
  before.focus();
  const stage = mount();
  expect(document.body.style.overflow).toBe('hidden');
  expect(document.documentElement.style.overflow).toBe('hidden');
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Arcade Game');
  expect(document.querySelector('[data-no-tab-swipe]')).not.toBeNull();
  stage.unmount();
  expect(document.body.style.getPropertyValue('overflow')).toBe('scroll');
  expect(document.body.style.getPropertyPriority('overflow')).toBe('important');
  expect(document.documentElement.style.cssText).toBe(original);
  expect(document.activeElement).toBe(before);
  before.remove();
});
it.each(['visibilitychange', 'blur', 'pagehide'])(
  'auto-pauses on %s and stays paused on return',
  (event) => {
    mount();
    tick(0);
    tick(500);
    expect(update.mock.calls.at(-1)?.[0]).toBe(1 / 20);
    act(() => {
      if (event === 'visibilitychange') {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event(event));
      } else window.dispatchEvent(new Event(event));
    });
    expect(screen.getByTestId('state').textContent).toContain('"paused":true');
    expect(document.querySelector('dialog')?.hasAttribute('open')).toBe(true);
    const calls = update.mock.calls.length;
    tick(1000);
    expect(update).toHaveBeenCalledTimes(calls);
    act(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByTestId('state').textContent).toContain('"paused":true');
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.getByTestId('state').textContent).toContain('"paused":false');
  },
);
it('toggles pause with P/Escape and sends End Run to the plugin', () => {
  mount();
  fireEvent.keyDown(window, { code: 'KeyP' });
  expect(document.querySelector('dialog')?.hasAttribute('open')).toBe(true);
  fireEvent.keyDown(window, { code: 'Escape' });
  expect(document.querySelector('dialog')?.hasAttribute('open')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  fireEvent.click(screen.getByRole('button', { name: 'End Run' }));
  expect(screen.getByTestId('state').textContent).toContain('"end":true');
});
it('defaults sound off, creates no AudioContext until an enabled gesture, and closes on unmount', () => {
  const stage = mount();
  tick(0);
  expect(screen.getByRole('button', { name: 'Sound' }).getAttribute('aria-pressed')).toBe('false');
  fireEvent.pointerDown(screen.getByTestId('state'));
  sfx.play('blip');
  expect(audio).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Sound' }));
  expect(localStorage.getItem('oyo-arcade-sound')).toBe('on');
  expect(audio).toHaveBeenCalledTimes(1);
  stage.unmount();
  expect(suspend).toHaveBeenCalled();
  expect(close).toHaveBeenCalled();
});
it('does not autoplay even with a saved sound preference', () => {
  localStorage.setItem('oyo-arcade-sound', 'on');
  mount();
  tick(0);
  expect(audio).not.toHaveBeenCalled();
  fireEvent.pointerDown(screen.getByTestId('state'));
  expect(audio).toHaveBeenCalledTimes(1);
  act(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(suspend).toHaveBeenCalled();
});
it('removes window/document listeners and cancels rAF on unmount', () => {
  const wa = vi.spyOn(window, 'addEventListener'),
    wr = vi.spyOn(window, 'removeEventListener');
  const da = vi.spyOn(document, 'addEventListener'),
    dr = vi.spyOn(document, 'removeEventListener');
  const stage = mount();
  tick(0);
  stage.unmount();
  for (const [type, fn] of wa.mock.calls)
    expect(wr.mock.calls.some(([t, f]) => t === type && f === fn)).toBe(true);
  for (const [type, fn] of da.mock.calls.filter(([type]) =>
    ['visibilitychange', 'gesturestart', 'gesturechange'].includes(type),
  ))
    expect(dr.mock.calls.some(([t, f]) => t === type && f === fn)).toBe(true);
  expect(cancelAnimationFrame).toHaveBeenCalled();
  expect(frames.size).toBe(0);
});
it('prevents zoom events while mounted', () => {
  mount();
  for (const type of ['gesturestart', 'gesturechange']) {
    const event = new Event(type, { cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  }
  const event = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
  screen.getByTestId('state').dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
});
it('renders once when stopped, on invalidation/resize, and never updates', () => {
  let invalidate = () => {};
  function Loop() {
    invalidate = useGameLoop(update, paint, { running: false }).invalidate;
    return null;
  }
  const view = render(<Loop />);
  tick(0);
  expect(paint).toHaveBeenCalledTimes(1);
  expect(update).not.toHaveBeenCalled();
  act(() => invalidate());
  tick(1);
  expect(paint).toHaveBeenCalledTimes(2);
  fireEvent(window, new Event('resize'));
  tick(2);
  expect(paint).toHaveBeenCalledTimes(3);
  view.unmount();
  expect(frames.size).toBe(0);
});
it('keeps held/pressed keys and aliases, and ignores modifiers and text inputs', () => {
  const state = new KeyState();
  state.press('KeyW');
  expect(state.down('up')).toBe(true);
  expect(state.pressed('up')).toBe(true);
  expect(state.pressed('up')).toBe(false);
  state.release('KeyW');
  expect(state.down('up')).toBe(false);
  const pressed = vi.fn();
  function Keyboard() {
    useKeys(pressed);
    return (
      <>
        <input aria-label="Input" />
        <button>Control</button>
      </>
    );
  }
  const view = render(<Keyboard />);
  for (const code of ['ArrowUp', 'KeyW', 'Space']) {
    const e = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  }
  const count = pressed.mock.calls.length;
  fireEvent.keyDown(window, { code: 'KeyW', ctrlKey: true });
  fireEvent.keyDown(screen.getByRole('textbox'), { code: 'ArrowUp' });
  for (const code of ['Enter', 'Space']) {
    const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true });
    screen.getByRole('button', { name: 'Control' }).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  }
  expect(pressed).toHaveBeenCalledTimes(count);
  view.unmount();
  fireEvent.keyDown(window, { code: 'ArrowUp' });
  expect(pressed).toHaveBeenCalledTimes(count);
});
it('recognizes taps and one swipe per captured pointer, with cancellation', () => {
  const gesture = vi.fn();
  function Pad() {
    return <div data-testid="pad" {...useGestures(gesture)} />;
  }
  vi.stubGlobal('PointerEvent', MouseEvent);
  render(<Pad />);
  const pad = screen.getByTestId('pad');
  fireEvent.pointerDown(pad, { clientX: 0, clientY: 0 });
  fireEvent.pointerUp(pad);
  expect(gesture).toHaveBeenLastCalledWith('tap');
  fireEvent.pointerDown(pad, { clientX: 0, clientY: 0 });
  fireEvent.pointerMove(pad, { clientX: 30, clientY: 0 });
  fireEvent.pointerMove(pad, { clientX: 60, clientY: 0 });
  fireEvent.pointerUp(pad);
  expect(gesture).toHaveBeenLastCalledWith('right');
  expect(gesture).toHaveBeenCalledTimes(2);
  fireEvent.pointerDown(pad);
  fireEvent.pointerCancel(pad);
  fireEvent.pointerUp(pad);
  expect(gesture).toHaveBeenCalledTimes(2);
});
it('caps DPR at two and disconnects its ResizeObserver', () => {
  const disconnect = vi.fn();
  const transform = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    setTransform: transform,
  } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal('devicePixelRatio', 3);
  function Canvas() {
    const { ref, ctx, size } = useCanvas({ maxDpr: 3 });
    return <canvas ref={ref} data-testid="canvas" data-dpr={size.dpr} onClick={() => ctx()} />;
  }
  const view = render(<Canvas />);
  fireEvent.click(screen.getByTestId('canvas'));
  expect(screen.getByTestId('canvas').getAttribute('data-dpr')).toBe('2');
  expect(transform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
  view.unmount();
  expect(disconnect).toHaveBeenCalledTimes(1);
});
