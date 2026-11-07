// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { ImageMetadata } from '../../../../shared/types';
import { PhotoViewer } from './PhotoViewer';
import { PhotoCarousel } from './PhotoCarousel';
import { PullToRefresh } from './PullToRefresh';
vi.mock('../ui', () => ({
  ApiImage: ({ alt }: { alt: string }) => <img alt={alt} />,
  IconButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
}));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
  vi.restoreAllMocks();
});
const images = [{ id: 'one' }, { id: 'two' }] as ImageMetadata[];
it('ignores stale close events after a modal is reopened', () => {
  const close = vi.fn();
  render(<PhotoViewer images={images} index={0} alt="Training" onClose={close} />);
  const dialog = screen.getByRole('dialog');
  fireEvent(dialog, new Event('close'));
  expect(close).not.toHaveBeenCalled();
  dialog.removeAttribute('open');
  fireEvent(dialog, new Event('close'));
  expect(close).toHaveBeenCalledOnce();
});
for (const dismiss of ['Close', 'Escape']) {
  it(`restores focus to an initially unfocused photo opener after ${dismiss}`, () => {
    render(<PhotoCarousel images={images} alt="Training" />);
    const opener = screen.getByRole('button', { name: 'Open Photo 1' });
    expect(document.activeElement).not.toBe(opener);
    fireEvent.click(opener);
    if (dismiss === 'Close') fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    else fireEvent(screen.getByRole('dialog'), new Event('cancel'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
}
it('locks scroll, zooms, resets on slide change and restores opener focus on close', () => {
  function Surface() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        {open && (
          <PhotoViewer images={images} index={0} alt="Training" onClose={() => setOpen(false)} />
        )}
      </>
    );
  }
  render(<Surface />);
  const opener = screen.getByRole('button', { name: 'Open' });
  opener.focus();
  fireEvent.click(opener);
  expect(document.body.style.overflow).toBe('hidden');
  const first = screen.getByAltText('Training, photo 1');
  fireEvent.doubleClick(first);
  expect(first.parentElement?.style.transform).toContain('scale(2)');
  const track = document.querySelector('.social-viewer-track')!;
  Object.defineProperty(track, 'clientWidth', { value: 393 });
  track.scrollLeft = 393;
  fireEvent.scroll(track);
  expect(screen.getByRole('status').textContent).toBe('2 of 2');
  expect(screen.getByAltText('Training, photo 2').parentElement?.style.transform).toContain(
    'scale(1)',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(document.body.style.overflow).toBe('');
  expect(document.activeElement).toBe(opener);
});
it('navigates photos with buttons and arrow keys, hides endpoints and resets zoom', () => {
  const close = vi.fn();
  render(<PhotoViewer images={images} index={0} alt="Training" onClose={close} />);
  const dialog = screen.getByRole('dialog');
  const previous = screen.getByLabelText('Previous Photo');
  const next = screen.getByLabelText('Next Photo');
  const track = document.querySelector('.social-viewer-track')!;
  Object.defineProperty(track, 'clientWidth', { value: 393 });
  expect(previous.style.visibility).toBe('hidden');
  fireEvent.doubleClick(screen.getByAltText('Training, photo 1'));
  fireEvent.click(next);
  expect(track.scrollLeft).toBe(393);
  expect(screen.getByRole('status').textContent).toBe('2 of 2');
  expect(next.style.visibility).toBe('hidden');
  expect(previous.style.visibility).toBe('visible');
  fireEvent.keyDown(dialog, { key: 'ArrowRight' });
  expect(screen.getByRole('status').textContent).toBe('2 of 2');
  fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
  expect(screen.getByAltText('Training, photo 1').parentElement?.style.transform).toContain(
    'scale(1)',
  );
  fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
  expect(track.scrollLeft).toBe(0);
  fireEvent.keyDown(dialog, { key: 'ArrowRight' });
  fireEvent.click(previous);
  expect(screen.getByRole('status').textContent).toBe('1 of 2');
  fireEvent(dialog, new Event('cancel'));
  expect(close).toHaveBeenCalledOnce();
});
it('hides navigation for a single photo or empty image list', () => {
  const { rerender } = render(
    <PhotoViewer images={images.slice(0, 1)} index={0} alt="Training" onClose={() => {}} />,
  );
  expect(screen.getByLabelText('Previous Photo').style.visibility).toBe('hidden');
  expect(screen.getByLabelText('Next Photo').style.visibility).toBe('hidden');
  rerender(<PhotoViewer images={[]} index={0} alt="Training" onClose={() => {}} />);
  expect(screen.getByRole('status').textContent).toBe('0 of 0');
});
function touch(target: Element, phase: string, y: number, count = 1, x = 0) {
  fireEvent(
    target,
    new TouchEvent(phase, {
      bubbles: true,
      touches: Array.from({ length: count }, () => ({ clientX: x, clientY: y })) as Touch[],
    }),
  );
}
it('refreshes exactly once per armed release and announces completion', async () => {
  let done!: () => void;
  const refresh = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        done = resolve;
      }),
  );
  render(
    <PullToRefresh onRefresh={refresh}>
      <p>Feed</p>
    </PullToRefresh>,
  );
  const root = screen.getByText('Feed');
  touch(root, 'touchstart', 0);
  touch(root, 'touchmove', 160);
  touch(root, 'touchend', 160, 0);
  touch(root, 'touchend', 160, 0);
  expect(refresh).toHaveBeenCalledTimes(1);
  touch(root, 'touchstart', 0);
  touch(root, 'touchmove', 160);
  touch(root, 'touchend', 160, 0);
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => done());
  expect(screen.getByRole('status').textContent).toBe('Feed updated');
});
it('ignores horizontal swipes, cancelled gestures, scroll and dialogs opened mid-pull', () => {
  const refresh = vi.fn().mockResolvedValue(undefined);
  render(
    <PullToRefresh onRefresh={refresh} label="Leaderboard">
      <button>Week</button>
      <dialog>Options</dialog>
    </PullToRefresh>,
  );
  const root = screen.getByRole('button', { name: 'Week' });
  touch(root, 'touchstart', 0);
  touch(root, 'touchmove', 20, 1, 100);
  touch(root, 'touchmove', 160);
  touch(root, 'touchend', 160, 0);
  touch(root, 'touchstart', 0);
  touch(root, 'touchmove', 160);
  touch(root, 'touchcancel', 160, 0);
  touch(root, 'touchend', 160, 0);
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(10);
  touch(root, 'touchstart', 0);
  touch(root, 'touchmove', 160);
  touch(root, 'touchend', 160, 0);
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0);
  touch(root, 'touchstart', 0);
  touch(root, 'touchmove', 160);
  document.querySelector('dialog')!.setAttribute('open', '');
  touch(root, 'touchend', 160, 0);
  expect(refresh).not.toHaveBeenCalled();
});
it('ignores short pulls, input starts, multiple fingers and open dialogs; failure can retry', async () => {
  const refresh = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  render(
    <PullToRefresh onRefresh={refresh}>
      <p>Feed</p>
      <input aria-label="Draft" />
      <dialog open>Photos</dialog>
    </PullToRefresh>,
  );
  const root = screen.getByText('Feed');
  touch(root, 'touchstart', 0);
  touch(root, 'touchmove', 160);
  touch(root, 'touchend', 160, 0);
  expect(refresh).not.toHaveBeenCalled();
  screen.getByRole('dialog').removeAttribute('open');
  for (const [target, distance, fingers] of [
    [root, 20, 1],
    [screen.getByRole('textbox'), 160, 1],
    [root, 160, 2],
  ] as const) {
    touch(target, 'touchstart', 0, fingers);
    touch(target, 'touchmove', distance, fingers);
    touch(target, 'touchend', distance, 0);
  }
  expect(refresh).not.toHaveBeenCalled();
  touch(root, 'touchstart', 0);
  touch(root, 'touchmove', 160);
  touch(root, 'touchend', 160, 0);
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  await act(async () => {});
  expect(screen.getByRole('status').textContent).toBe('');
  touch(root, 'touchstart', 0);
  touch(root, 'touchmove', 160);
  touch(root, 'touchend', 160, 0);
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Feed updated'));
});
