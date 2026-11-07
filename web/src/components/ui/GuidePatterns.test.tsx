// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Sheet } from './Sheet';
import { StrictMode } from 'react';
import { ZoneOption } from './ZoneChip';
import { Select } from './Select';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('keeps styled selects native and labelled', () => {
  const change = vi.fn();
  render(
    <Select label="Modality" defaultValue="all" onChange={change}>
      <option value="all">All</option>
      <option value="erg">Erg</option>
    </Select>,
  );
  const select = screen.getByRole('combobox', { name: 'Modality' }) as HTMLSelectElement;
  expect(select.classList.contains('appearance-none')).toBe(true);
  fireEvent.change(select, { target: { value: 'erg' } });
  expect(select.value).toBe('erg');
  expect(change).toHaveBeenCalledOnce();
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
  for (const radio of screen.getAllByRole('radio')) {
    expect(radio.closest('label')?.classList.contains('min-h-11')).toBe(true);
    expect(radio.closest('label')?.classList.contains('min-w-11')).toBe(true);
  }
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
  fireEvent.pointerDown(screen.getByText('Open'));
  rerender(
    <>
      <button>Open</button>
      <Sheet open title="Options" onClose={close}>
        Body
      </Sheet>
    </>,
  );
  expect(document.body.style.overflow).toBe('hidden');
  expect(screen.getByRole('dialog', { name: 'Options' }).getAttribute('aria-modal')).toBe('true');
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Options' }));
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
