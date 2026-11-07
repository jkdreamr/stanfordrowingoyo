// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/ui';
import { createFixtures } from '../../mock/fixtures';
import { RemoveAccount } from './RemoveAccount';

const request = vi.hoisted(() => vi.fn());
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof import('../../lib/api')>()),
  api: request,
}));
beforeEach(() => {
  request.mockReset().mockResolvedValue(undefined);
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => cleanup());
function setup() {
  const user = createFixtures().users[0];
  const close = vi.fn();
  const onRemoved = vi.fn();
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RemoveAccount user={user} close={close} onRemoved={onRemoved} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, close, onRemoved, invalidate };
}
it('requires the exact account email and lets the admin cancel without a request', () => {
  const { close } = setup();
  expect(
    (screen.getByRole('button', { name: 'Remove Account' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText('Confirm Email'), {
    target: { value: 'wrong@example.com' },
  });
  expect(
    (screen.getByRole('button', { name: 'Remove Account' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(close).toHaveBeenCalledOnce();
  expect(request).not.toHaveBeenCalled();
});
it('submits confirmed removal, invalidates cached views and closes after success', async () => {
  const { user, onRemoved, invalidate } = setup();
  fireEvent.change(screen.getByLabelText('Confirm Email'), { target: { value: user.email } });
  fireEvent.click(screen.getByRole('button', { name: 'Remove Account' }));
  await waitFor(() => expect(onRemoved).toHaveBeenCalledOnce());
  expect(request).toHaveBeenCalledWith('POST /api/admin/users/:id/remove', {
    params: { id: user.id },
    body: { confirmation_email: user.email },
  });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['api'] });
});
it('keeps confirmation on an error so the admin can retry', async () => {
  request.mockRejectedValueOnce(new TypeError('offline'));
  const { user, onRemoved } = setup();
  fireEvent.change(screen.getByLabelText('Confirm Email'), { target: { value: user.email } });
  fireEvent.click(screen.getByRole('button', { name: 'Remove Account' }));
  expect(
    await screen.findByText('Could not connect. Check your connection and try again'),
  ).toBeTruthy();
  expect((screen.getByLabelText('Confirm Email') as HTMLInputElement).value).toBe(user.email);
  expect(onRemoved).not.toHaveBeenCalled();
});
