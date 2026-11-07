// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ProfilePhotoCrop } from './ProfilePhotoCrop';
const { decode, encodeCrop } = vi.hoisted(() => ({ decode: vi.fn(), encodeCrop: vi.fn() }));
vi.mock('../lib/images', () => ({ decode, encodeCrop }));
vi.mock('./ui', () => ({
  Sheet: ({ children, footer }: { children: ReactNode; footer: ReactNode }) => (
    <div>
      {children}
      {footer}
    </div>
  ),
  Button: ({
    children,
    fullWidth: _fullWidth,
    loading: _loading,
    ...props
  }: {
    children: ReactNode;
    fullWidth?: boolean;
    loading?: boolean;
  }) => <button {...props}>{children}</button>,
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});
it('keeps undecodable and HEIC photos cancellable without changing the draft', async () => {
  const cancel = vi.fn(),
    done = vi.fn();
  decode.mockRejectedValue(new Error('Decode failed'));
  const { unmount } = await act(async () =>
    render(
      <ProfilePhotoCrop file={new File(['bad'], 'bad.jpg')} onCancel={cancel} onDone={done} />,
    ),
  );
  expect(screen.getByText("Can't open this photo. Try a JPEG or PNG")).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Done' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(done).not.toHaveBeenCalled();
  unmount();
  decode.mockClear();
  await act(async () =>
    render(
      <ProfilePhotoCrop file={new File(['heic'], 'photo.heic')} onCancel={cancel} onDone={done} />,
    ),
  );
  expect(decode).not.toHaveBeenCalled();
  expect(screen.getByText("Can't open this photo. Try a JPEG or PNG")).toBeTruthy();
});
it('encodes the zoomed source crop only on Done and releases the decoded image', async () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect() {},
    drawImage() {},
  } as unknown as CanvasRenderingContext2D);
  const image = { source: {}, width: 800, height: 400, close: vi.fn() };
  const blob = new Blob(['crop'], { type: 'image/webp' });
  decode.mockResolvedValue(image);
  encodeCrop.mockResolvedValue(blob);
  const done = vi.fn();
  const { unmount } = await act(async () =>
    render(
      <ProfilePhotoCrop file={new File(['photo'], 'photo.jpg')} onCancel={vi.fn()} onDone={done} />,
    ),
  );
  fireEvent.change(screen.getByLabelText('Zoom'), { target: { value: '2' } });
  expect(done).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Done' })));
  expect(encodeCrop).toHaveBeenCalledWith(image, { x: 300, y: 100, width: 200, height: 200 });
  expect(done).toHaveBeenCalledWith(blob);
  unmount();
  expect(image.close).toHaveBeenCalledOnce();
});
