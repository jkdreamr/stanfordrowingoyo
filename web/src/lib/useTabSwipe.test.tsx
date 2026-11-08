// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { useTabSwipe } from './useTabSwipe';

let path = '/feed';
let mobile = true;
let reduced = false;
const navigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: path }),
  useNavigate: () => navigate,
}));
vi.mock('../components/shell/Navigation', () => ({
  main: [{ to: '/' }, { to: '/feed' }, { to: '/leaderboard' }, { to: '/me' }],
}));
function Surface() {
  const ref = useRef<HTMLElement>(null);
  const navigateTab = useTabSwipe(ref);
  return (
    <main ref={ref}>
      <div data-testid="target" />
      <button onClick={() => navigateTab('/leaderboard')}>Leaderboard</button>
      <button onClick={() => navigateTab('/feed')}>Feed</button>
    </main>
  );
}
beforeEach(() => {
  path = '/feed';
  mobile = true;
  reduced = false;
  vi.stubGlobal('innerWidth', 400);
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('max-width') ? mobile : reduced;
    },
  }));
  Element.prototype.animate = vi.fn(
    () =>
      ({ finished: Promise.resolve(), cancel: vi.fn(), finish: vi.fn() }) as unknown as Animation,
  );
});
for (const interruption of ['touchstart', 'second finger', 'resize']) {
  it(`finishes a committed exit exactly once on ${interruption}`, async () => {
    let finish!: () => void;
    const cancel = vi.fn();
    vi.mocked(Element.prototype.animate).mockImplementation(
      () =>
        ({
          finished: new Promise<void>((resolve) => {
            finish = resolve;
          }),
          cancel,
          finish: vi.fn(),
        }) as unknown as Animation,
    );
    const { getByTestId } = render(<Surface />);
    const target = getByTestId('target');
    await swipe(target);
    expect(navigate).not.toHaveBeenCalled();
    if (interruption === 'resize') {
      mobile = false;
      fireEvent(window, new Event('resize'));
    } else touch(target, 'touchstart', 200, 200, interruption === 'second finger' ? 2 : 1);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/leaderboard', { preventScrollReset: true });
    expect(target.parentElement?.style.transform).toBe('');
    expect(target.parentElement?.style.opacity).toBe('0');
    expect(cancel).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(navigate).toHaveBeenCalledTimes(1);
  });
}
it('restores the latest scroll after leaving a tab by another navigation method', async () => {
  path = '/';
  vi.stubGlobal('scrollY', 375);
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  const { getByTestId, rerender } = render(<Surface />);
  fireEvent.scroll(window);
  path = '/feed';
  rerender(<Surface />);
  vi.stubGlobal('scrollY', 0);
  await swipe(getByTestId('target'), 80, 280);
  expect(navigate).toHaveBeenLastCalledWith('/', { preventScrollReset: true });
  path = '/';
  rerender(<Surface />);
  expect(scrollTo).toHaveBeenLastCalledWith(0, 375);
});
it('keeps the exit hidden until the destination layout replaces it', async () => {
  const cancel = vi.fn();
  vi.mocked(Element.prototype.animate).mockReturnValue({
    finished: Promise.resolve(),
    cancel,
  } as unknown as Animation);
  const { getByTestId, rerender } = render(<Surface />);
  await swipe(getByTestId('target'));
  expect(cancel).not.toHaveBeenCalled();
  expect(getByTestId('target').parentElement?.style.opacity).toBe('0');
  path = '/leaderboard';
  rerender(<Surface />);
  expect(cancel).toHaveBeenCalled();
  expect(Element.prototype.animate).toHaveBeenLastCalledWith(
    [
      { transform: 'translate3d(24px,0,0)', opacity: 0 },
      { transform: 'translate3d(0,0,0)', opacity: 1 },
    ],
    expect.objectContaining({ duration: 220 }),
  );
});
it('shares arrival motion for taps and ignores the active tab', async () => {
  const { getByRole, rerender } = render(<Surface />);
  fireEvent.click(getByRole('button', { name: 'Feed' }));
  expect(navigate).not.toHaveBeenCalled();
  expect(Element.prototype.animate).not.toHaveBeenCalled();
  fireEvent.click(getByRole('button', { name: 'Leaderboard' }));
  expect(navigate).toHaveBeenCalledWith('/leaderboard', { preventScrollReset: true });
  path = '/leaderboard';
  rerender(<Surface />);
  expect(Element.prototype.animate).toHaveBeenLastCalledWith(
    [
      { transform: 'translate3d(24px,0,0)', opacity: 0 },
      { transform: 'translate3d(0,0,0)', opacity: 1 },
    ],
    expect.objectContaining({ duration: 220 }),
  );
  await act(async () => {});
  expect(document.querySelector('main')?.getAttribute('style')).toBe('');
});
it('keeps desktop taps instant', () => {
  mobile = false;
  const { getByRole, rerender } = render(<Surface />);
  fireEvent.click(getByRole('button', { name: 'Leaderboard' }));
  expect(navigate).toHaveBeenCalledWith('/leaderboard', { preventScrollReset: false });
  path = '/leaderboard';
  rerender(<Surface />);
  expect(Element.prototype.animate).not.toHaveBeenCalled();
});
for (const method of ['tap', 'swipe']) {
  it(`recovers from a stalled ${method} navigation within 400ms`, async () => {
    vi.useFakeTimers();
    const { getByRole, getByTestId } = render(<Surface />);
    const target = getByTestId('target');
    if (method === 'tap') fireEvent.click(getByRole('button', { name: 'Leaderboard' }));
    else await swipe(target);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(target.parentElement?.style.opacity).toBe('0');
    act(() => vi.advanceTimersByTime(399));
    expect(target.parentElement?.style.opacity).toBe('0');
    act(() => vi.advanceTimersByTime(1));
    expect(target.parentElement?.style.opacity).toBe('');
    expect(target.parentElement?.style.transform).toBe('');
    expect(target.parentElement?.style.willChange).toBe('');
    await swipe(target);
    expect(navigate).toHaveBeenCalledTimes(2);
  });
}
it('does not let a departed navigation timer cancel the destination arrival', async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  vi.mocked(Element.prototype.animate).mockReturnValue({
    finished: new Promise(() => {}),
    cancel,
  } as unknown as Animation);
  const { getByRole, rerender } = render(<Surface />);
  fireEvent.click(getByRole('button', { name: 'Leaderboard' }));
  path = '/leaderboard';
  rerender(<Surface />);
  cancel.mockClear();
  act(() => vi.advanceTimersByTime(400));
  expect(cancel).not.toHaveBeenCalled();
});
it('only registers passive scroll recording for mobile tab routes, including after resize', () => {
  mobile = false;
  const add = vi.spyOn(window, 'addEventListener');
  const remove = vi.spyOn(window, 'removeEventListener');
  const { rerender, unmount } = render(<Surface />);
  expect(add.mock.calls.filter(([name]) => name === 'scroll')).toHaveLength(0);
  mobile = true;
  fireEvent(window, new Event('resize'));
  expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
  const listener = add.mock.calls.find(([name]) => name === 'scroll')![1];
  path = '/log';
  rerender(<Surface />);
  expect(remove).toHaveBeenCalledWith('scroll', listener);
  expect(add.mock.calls.filter(([name]) => name === 'scroll')).toHaveLength(1);
  unmount();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  navigate.mockClear();
  document.body.style.overflow = '';
});
function touch(target: Element, type: string, x: number, y = 200, count = 1) {
  const event = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: Array.from({ length: count }, () => ({ clientX: x, clientY: y })) as Touch[],
  });
  fireEvent(target, event);
  return event;
}
async function swipe(target: Element, from = 280, to = 80, y = 200) {
  touch(target, 'touchstart', from);
  const move = touch(target, 'touchmove', to, y);
  touch(target, 'touchend', to, y, 0);
  await act(async () => {});
  return move;
}
for (const [from, to, destination] of [
  [280, 80, '/leaderboard'],
  [80, 280, '/'],
] as const) {
  it(`commits to neighbouring tab ${destination}`, async () => {
    const { getByTestId } = render(<Surface />);
    await swipe(getByTestId('target'), from, to);
    expect(navigate).toHaveBeenLastCalledWith(destination, { preventScrollReset: true });
  });
}
it('never prevents vertical scrolling and stays vertically locked', async () => {
  const { getByTestId } = render(<Surface />);
  const target = getByTestId('target');
  touch(target, 'touchstart', 280);
  expect(touch(target, 'touchmove', 270, 250).defaultPrevented).toBe(false);
  expect(touch(target, 'touchmove', 80, 250).defaultPrevented).toBe(false);
  touch(target, 'touchend', 80, 250, 0);
  await act(async () => {});
  expect(navigate).not.toHaveBeenCalled();
});
for (const reason of [
  'edge',
  'scroller',
  'opt-out',
  'dialog',
  'desktop',
  'route',
  'keyboard',
  'selection',
  'locked',
]) {
  it(`ignores ${reason}`, async () => {
    if (reason === 'desktop') mobile = false;
    if (reason === 'route') path = '/log';
    const { getByTestId } = render(<Surface />);
    const target = getByTestId('target');
    if (reason === 'scroller') {
      target.style.overflowX = 'auto';
      Object.defineProperties(target, { scrollWidth: { value: 600 }, clientWidth: { value: 300 } });
    }
    if (reason === 'opt-out') target.setAttribute('data-no-tab-swipe', '');
    if (reason === 'dialog')
      document.body.appendChild(document.createElement('dialog')).setAttribute('open', '');
    if (reason === 'keyboard') {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
    }
    if (reason === 'selection')
      vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: false } as Selection);
    if (reason === 'locked') document.body.style.overflow = 'hidden';
    expect((await swipe(target, reason === 'edge' ? 10 : 280)).defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    document.querySelectorAll('body > dialog, body > input').forEach((node) => node.remove());
  });
}
it('aborts when another finger lands', async () => {
  const { getByTestId } = render(<Surface />);
  const target = getByTestId('target');
  touch(target, 'touchstart', 280);
  touch(target, 'touchmove', 80);
  touch(target, 'touchstart', 80, 200, 2);
  touch(target, 'touchend', 80, 200, 0);
  await act(async () => {});
  expect(navigate).not.toHaveBeenCalled();
});
for (const [route, from, to] of [
  ['/', 80, 280],
  ['/me', 280, 80],
] as const) {
  it(`does not wrap at ${route}`, async () => {
    path = route;
    const { getByTestId } = render(<Surface />);
    await swipe(getByTestId('target'), from, to);
    expect(navigate).not.toHaveBeenCalled();
  });
}
it('uses opacity only with reduced motion', async () => {
  reduced = true;
  const { getByTestId } = render(<Surface />);
  await swipe(getByTestId('target'));
  expect(navigate).toHaveBeenCalled();
  expect(Element.prototype.animate).toHaveBeenCalledWith(
    [{ opacity: 1 }, { opacity: 0 }],
    expect.anything(),
  );
});
it('commits a fast short flick', async () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const { getByTestId } = render(<Surface />);
  const target = getByTestId('target');
  touch(target, 'touchstart', 280);
  now = 40;
  touch(target, 'touchmove', 240);
  now = 50;
  touch(target, 'touchend', 240, 200, 0);
  await act(async () => {});
  expect(navigate).toHaveBeenCalledWith('/leaderboard', { preventScrollReset: true });
});
it('snaps back a slow short drag', async () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const { getByTestId } = render(<Surface />);
  const target = getByTestId('target');
  touch(target, 'touchstart', 280);
  now = 500;
  touch(target, 'touchmove', 240);
  now = 700;
  touch(target, 'touchend', 240, 200, 0);
  await act(async () => {});
  expect(navigate).not.toHaveBeenCalled();
  expect(target.parentElement?.style.transform).toBe('');
});
