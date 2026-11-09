// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { DialogPresence } from './DialogPresence';
import { Sheet } from './Sheet';

const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
let reduced = false;
let desktop = false;
let mediaChange: (() => void) | undefined;
let exits: { frames: Keyframe[]; finish: () => void; cancel: ReturnType<typeof vi.fn> }[];

beforeEach(() => {
  reduced = false;
  desktop = false;
  exits = [];
  mediaChange = undefined;
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('reduced-motion') ? reduced : desktop;
    },
    addEventListener: (_event: string, listener: () => void) => {
      mediaChange = listener;
    },
    removeEventListener: vi.fn(),
  }));
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value: (frames: Keyframe[]) => {
      let resolve!: () => void;
      let reject!: (reason: Error) => void;
      const finished = new Promise<void>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      const animation = {
        finished,
        finish: () => resolve(),
        cancel: vi.fn(() => reject(new Error('Cancelled'))),
      };
      exits.push({ frames, finish: animation.finish, cancel: animation.cancel });
      return animation;
    },
  });
});
afterEach(() => {
  cleanup();
  if (originalAnimate) Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
  else Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Surface({ close }: { close: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <DialogPresence>
        {open && (
          <Sheet
            open
            title="Editor"
            onClose={() => {
              close();
              setOpen(false);
            }}
          >
            Saved editor content
          </Sheet>
        )}
      </DialogPresence>
    </>
  );
}

it.each([false, true])('retains a conditional sheet through its exit, desktop=%s', async (wide) => {
  desktop = wide;
  const close = vi.fn();
  render(<Surface close={close} />);
  const opener = screen.getByText('Open');
  opener.focus();
  fireEvent.click(opener);
  const dialog = screen.getByRole('dialog', { name: 'Editor' });
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(dialog.isConnected).toBe(true);
  expect(dialog.hasAttribute('open')).toBe(true);
  expect(dialog.textContent).toContain('Saved editor content');
  expect(document.body.style.overflow).toBe('hidden');
  expect(exits[0].frames[1].transform).toBe(wide ? 'scale(0.96)' : 'translateY(100%)');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(close).toHaveBeenCalledOnce();
  await act(async () => exits[0].finish());
  expect(dialog.isConnected).toBe(false);
  expect(document.body.style.overflow).toBe('');
  expect(document.activeElement).toBe(opener);
});

it('closes reduced-motion sheets immediately without spatial animation', () => {
  reduced = true;
  render(<Surface close={vi.fn()} />);
  const opener = screen.getByText('Open');
  opener.focus();
  fireEvent.click(opener);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(exits).toHaveLength(0);
  expect(document.activeElement).toBe(opener);
});
it('releases hidden sheet content only after the exit has finished', async () => {
  const view = render(
    <Sheet open={false} title="Loading" onClose={vi.fn()}>
      <div className="ui-skeleton">Loading content</div>
    </Sheet>,
  );
  expect(document.querySelector('.ui-skeleton')).toBeNull();
  view.rerender(
    <Sheet open title="Loading" onClose={vi.fn()}>
      <div className="ui-skeleton">Loading content</div>
    </Sheet>,
  );
  expect(document.querySelector('.ui-skeleton')).not.toBeNull();
  view.rerender(
    <Sheet open={false} title="Loading" onClose={vi.fn()}>
      <div className="ui-skeleton">Loading content</div>
    </Sheet>,
  );
  expect(document.querySelector('.ui-skeleton')).not.toBeNull();
  await act(async () => exits[0].finish());
  expect(document.querySelector('.ui-skeleton')).toBeNull();
});

it('releases a conditional sheet after an external native close without a stale scroll lock', () => {
  const close = vi.fn();
  render(<Surface close={close} />);
  const opener = screen.getByText('Open');
  opener.focus();
  fireEvent.click(opener);
  const dialog = screen.getByRole('dialog') as HTMLDialogElement;
  dialog.close();
  fireEvent(dialog, new Event('close'));
  expect(close).toHaveBeenCalledOnce();
  expect(dialog.isConnected).toBe(false);
  expect(document.body.style.overflow).toBe('');
  expect(document.activeElement).toBe(opener);
});

it('finishes an in-flight exit when reduced motion is enabled', async () => {
  render(<Surface close={vi.fn()} />);
  fireEvent.click(screen.getByText('Open'));
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  reduced = true;
  await act(async () => mediaChange?.());
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.body.style.overflow).toBe('');
});

it('cancels an old exit on reopen and never closes the new sheet', async () => {
  render(<Surface close={vi.fn()} />);
  const opener = screen.getByText('Open');
  fireEvent.click(opener);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(opener);
  expect(exits[0].cancel).toHaveBeenCalledOnce();
  await act(async () => exits[0].finish());
  expect(screen.getByRole('dialog', { name: 'Editor' }).hasAttribute('open')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  await act(async () => exits[1].finish());
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('waits for nested dialogs and restores scroll and the original opener exactly once', async () => {
  function Tree({ open }: { open: boolean }) {
    return (
      <>
        <button>Original Opener</button>
        <DialogPresence>
          {open && (
            <Sheet open title="Parent" onClose={vi.fn()}>
              <DialogPresence>
                <Sheet open title="Child" onClose={vi.fn()}>
                  Child content
                </Sheet>
              </DialogPresence>
            </Sheet>
          )}
        </DialogPresence>
      </>
    );
  }
  const view = render(<Tree open={false} />);
  const opener = screen.getByText('Original Opener');
  opener.focus();
  view.rerender(<Tree open />);
  const parent = screen.getByRole('dialog', { name: 'Parent' });
  view.rerender(<Tree open={false} />);
  expect(exits).toHaveLength(2);
  await act(async () => exits[1].finish());
  expect(document.body.style.overflow).toBe('hidden');
  expect(parent.isConnected).toBe(true);
  await act(async () => exits[0].finish());
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.body.style.overflow).toBe('');
  expect(document.activeElement).toBe(opener);
});
