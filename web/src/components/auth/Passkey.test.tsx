// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { createQueryClient } from '../../lib/queryClient';
import { createMockApi } from '../../mock/handlers';
import { RequireAuth } from '../shell/RequireAuth';
import { AuthLayout } from './AuthLayout';
import { PasskeyOffer } from './PasskeyOffer';
import Login from '../../pages/Login';
import Settings from '../../pages/Settings';
import { ThemeProvider } from '../../lib/theme';
import { ToastProvider } from '../ui';
import { markPasskeyOffer, passkeyOfferDismissed } from '../../lib/passkeys';

const buffer = (...values: number[]) => new Uint8Array(values).buffer;
const credentials = { get: vi.fn(), create: vi.fn() };
const capabilities = { platform: true, conditional: false };
const assertion = (id: string) => ({
  id,
  rawId: buffer(1),
  response: {
    clientDataJSON: buffer(2),
    authenticatorData: buffer(3),
    signature: buffer(4),
    userHandle: buffer(5),
  },
});
const attestation = (id: string) => ({
  id,
  rawId: buffer(1),
  response: {
    clientDataJSON: buffer(2),
    attestationObject: buffer(3),
    getTransports: () => ['internal'],
  },
});
const clients: ReturnType<typeof createQueryClient>[] = [];
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  capabilities.platform = true;
  capabilities.conditional = false;
  credentials.get.mockReset();
  credentials.create.mockReset();
  vi.stubGlobal(
    'PublicKeyCredential',
    Object.assign(function PublicKeyCredential() {}, {
      isUserVerifyingPlatformAuthenticatorAvailable: async () => capabilities.platform,
      isConditionalMediationAvailable: async () => capabilities.conditional,
    }),
  );
  Object.defineProperty(navigator, 'credentials', { value: credentials, configurable: true });
});
afterEach(() => {
  cleanup();
  clients.forEach((c) => c.clear());
  clients.length = 0;
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});
async function call(
  mock: ReturnType<typeof createMockApi>,
  method: string,
  path: string,
  body?: unknown,
) {
  return mock.handle(
    new Request('http://localhost' + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-OYO-CSRF': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}
function setup(path: string, mock = createMockApi({ session: null })) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL, init?: RequestInit) => mock.handle(new Request(String(url), init))),
  );
  const client = createQueryClient();
  clients.push(client);
  const router = createMemoryRouter(
    [
      {
        element: <Outlet />,
        children: [
          { element: <AuthLayout />, children: [{ path: '/login', element: <Login /> }] },
          {
            element: (
              <>
                <RequireAuth />
                <PasskeyOffer />
              </>
            ),
            children: [
              { path: '/settings', element: <Settings /> },
              {
                path: '/',
                element: (
                  <main>
                    <h1>Training Home</h1>
                  </main>
                ),
              },
            ],
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { mock, router, client };
}
async function mockWithPasskey(id = 'cred-1') {
  const mock = createMockApi({ session: 'user-1' });
  expect((await call(mock, 'POST', '/api/me/passkeys', { id })).status).toBe(201);
  await call(mock, 'POST', '/api/auth/logout');
  return mock;
}

describe('passkey login', () => {
  it('signs in with the passkey button and opts the email field into autofill', async () => {
    const { router } = setup('/login', await mockWithPasskey());
    credentials.get.mockResolvedValue(assertion('cred-1'));
    expect(await screen.findByLabelText('Email')).toHaveProperty(
      'autocomplete',
      'username webauthn',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Log In with Passkey' }));
    expect(await screen.findByRole('heading', { name: 'Training Home' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
    expect(credentials.get.mock.calls[0][0]).toMatchObject({ mediation: 'optional' });
  });
  it('completes a conditional autofill sign-in without a tap', async () => {
    capabilities.conditional = true;
    credentials.get.mockResolvedValue(assertion('cred-1'));
    setup('/login', await mockWithPasskey());
    expect(await screen.findByRole('heading', { name: 'Training Home' })).toBeTruthy();
    expect(credentials.get.mock.calls[0][0]).toMatchObject({ mediation: 'conditional' });
  });
  it('keeps a failed background autofill request silent', async () => {
    capabilities.conditional = true;
    credentials.get.mockRejectedValueOnce(new DOMException('failed', 'NotSupportedError'));
    setup('/login');
    await waitFor(() => expect(credentials.get).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('explains an unknown passkey and stays quiet on cancel', async () => {
    setup('/login');
    credentials.get.mockRejectedValueOnce(new DOMException('cancel', 'NotAllowedError'));
    fireEvent.click(await screen.findByRole('button', { name: 'Log In with Passkey' }));
    await waitFor(() => expect(credentials.get).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
    credentials.get.mockResolvedValueOnce(assertion('nope'));
    fireEvent.click(screen.getByRole('button', { name: 'Log In with Passkey' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Passkey not found. Log in with your password',
    );
  });
  it('hides the button without WebAuthn', async () => {
    vi.stubGlobal('PublicKeyCredential', undefined);
    setup('/login');
    expect(await screen.findByRole('button', { name: 'Log In' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Passkey/ })).toBeNull();
  });
});

describe('passkey enrollment', () => {
  it('offers setup once after a password login', async () => {
    const { mock, client } = setup('/login');
    const clear = client.clear.bind(client);
    const clearSpy = vi.spyOn(client, 'clear').mockImplementation(() => {
      expect(sessionStorage.getItem('oyo.passkey-offer')).toBe('1');
      clear();
    });
    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: mock.state.users[0].email },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    const dialog = await screen.findByRole('dialog', { name: 'Log In with Passkey?' });
    expect(clearSpy).toHaveBeenCalledOnce();
    clearSpy.mockRestore();
    credentials.create.mockResolvedValue(attestation('cred-new'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Turn On' }));
    expect(await screen.findByText('Passkey is on')).toBeTruthy();
    expect(credentials.create.mock.calls[0][0].publicKey.authenticatorSelection).toMatchObject({
      authenticatorAttachment: 'platform',
      userVerification: 'required',
    });
    const list = await (await call(mock, 'GET', '/api/me/passkeys')).json();
    expect(list.map((p: { id: string }) => p.id)).toEqual(['cred-new']);
  });
  it('remembers Not Now and skips devices without a platform authenticator', async () => {
    markPasskeyOffer();
    setup('/', createMockApi({ session: 'user-1' }));
    const dialog = await screen.findByRole('dialog', { name: 'Log In with Passkey?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Not Now' }));
    await waitFor(() => expect(passkeyOfferDismissed('user-1')).toBe(true));
    cleanup();
    capabilities.platform = false;
    markPasskeyOffer();
    setup('/', createMockApi({ session: 'user-2' }));
    await screen.findByRole('heading', { name: 'Training Home' });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('dialog', { name: 'Log In with Passkey?' })).toBeNull();
  });
  it('adds, lists and removes passkeys in Settings', async () => {
    setup('/settings', createMockApi({ session: 'user-1' }));
    credentials.create.mockResolvedValue(attestation('cred-a'));
    fireEvent.click(await screen.findByRole('button', { name: /Set Up Passkey/ }));
    const row = await screen.findByRole('button', { name: /iPhone/ });
    expect(row.textContent).toContain('Added');
    fireEvent.click(row);
    const confirm = await screen.findByRole('dialog', { name: 'Remove Passkey?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /iPhone/ })).toBeNull());
    expect(await screen.findByText('Passkey removed')).toBeTruthy();
  });
  it('asks for the password when the login is not recent', async () => {
    const mock = createMockApi({ session: 'user-1' });
    mock.passkeyPolicy.requireReauth = true;
    setup('/settings', mock);
    fireEvent.click(await screen.findByRole('button', { name: /Set Up Passkey/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Set Up Passkey' });
    fireEvent.change(within(sheet).getByLabelText('Current Password'), {
      target: { value: 'password' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Verify' }));
    credentials.create.mockResolvedValue(attestation('cred-b'));
    fireEvent.click(await within(sheet).findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: /iPhone/ })).toBeTruthy();
    expect(credentials.create).toHaveBeenCalledTimes(1);
  });
});
