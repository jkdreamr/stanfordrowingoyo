// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Sheet } from './Sheet';
import { StrictMode } from 'react';
import { ZoneOption } from './ZoneChip';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('offers native exclusive zone radios with visible badges', () => {
  const change = vi.fn();
  render(
    <fieldset aria-label="Zone">
      <ZoneOption zone="E" selected onClick={change} />
      <ZoneOption zone="D" selected={false} onClick={change} />
    </fieldset>,
  );
  expect((screen.getByRole('radio', { name: 'Zone E' }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('radio', { name: 'Zone D' }));
  expect(change).toHaveBeenCalledOnce();
});
it('locks sheet background, supports Escape and returns focus on close', () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function () {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function () {
      this.removeAttribute('open');
    },
  });
  const close = vi.fn();
  const { rerender } = render(
    <>
      <button>Open</button>
      <Sheet open={false} title="Options" onClose={close}>
        Body
      </Sheet>
    </>,
  );
  screen.getByText('Open').focus();
  rerender(
    <>
      <button>Open</button>
      <Sheet open title="Options" onClose={close}>
        Body
      </Sheet>
    </>,
  );
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(close).toHaveBeenCalledOnce();
  rerender(
    <>
      <button>Open</button>
      <Sheet open={false} title="Options" onClose={close}>
        Body
      </Sheet>
    </>,
  );
  expect(document.body.style.overflow).toBe('');
  expect(document.activeElement).toBe(screen.getByText('Open'));
  const mounted = render(
    <StrictMode>
      <Sheet open title="Initially Open" onClose={close}>
        Body
      </Sheet>
    </StrictMode>,
  );
  expect(document.body.style.overflow).toBe('hidden');
  mounted.unmount();
  expect(document.body.style.overflow).toBe('');
});
