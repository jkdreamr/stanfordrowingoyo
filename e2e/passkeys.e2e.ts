import { test, expect } from './fixtures';
import type { BrowserContext, Page } from '@playwright/test';
import { openSettings } from './helpers';

const passkeyButton = (page: Page) =>
  page.getByRole('button', {
    name: /^Log In with (Face ID|Touch ID|Fingerprint|Windows Hello|Passkey)$/,
  });

/** Chromium-only: a CDP virtual platform authenticator with user verification. */
async function addVirtualAuthenticator(context: BrowserContext, page: Page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return {
    credentials: async () =>
      (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials,
  };
}
async function logOut(page: Page) {
  if (new URL(page.url()).pathname !== '/settings') await openSettings(page);
  await page.getByRole('button', { name: 'Log Out', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Log Out?' })
    .getByRole('button', { name: 'Log Out', exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
}
async function passwordLogin(page: Page, email: string, password: string) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
}

test('login page offers passkey sign-in with autofill', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute(
    'autocomplete',
    'username webauthn',
  );
  // Playwright's WebKit build exposes PublicKeyCredential without navigator.credentials.
  const supported = await page.evaluate(
    () => typeof window.PublicKeyCredential === 'function' && !!navigator.credentials,
  );
  await expect(passkeyButton(page)).toHaveCount(supported ? 1 : 0);
});

test('passkey setup after password login, sign-in, and removal', async ({
  makeRower,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Virtual authenticators are CDP-only; WebKit cannot complete a WebAuthn ceremony headlessly',
  );
  test.skip(process.env.E2E_MOCK === '1', 'Signature verification needs the real worker');
  const { page, context, user, password } = await makeRower();
  const authenticator = await addVirtualAuthenticator(context, page);
  await logOut(page);
  await passwordLogin(page, user.email, password);
  const offer = page.getByRole('dialog', { name: /^Log In with .+\?$/ });
  await expect(offer).toBeVisible();
  await offer.getByRole('button', { name: 'Turn On', exact: true }).click();
  await expect(offer).not.toBeVisible();
  expect(await authenticator.credentials()).toHaveLength(1);

  await openSettings(page);
  const row = page.getByRole('button', { name: /Added/ });
  await expect(row).toHaveCount(1);

  // Conditional UI: the virtual authenticator answers the autofill request without a tap.
  await logOut(page);
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  const me = await (await page.request.get('/api/me')).json();
  expect(me.id).toBe(user.id);
  const [passkey] = await (await page.request.get('/api/me/passkeys')).json();
  expect(passkey.last_used_at).toBeTruthy();

  // Explicit button, with autofill disabled for the next documents.
  await page.addInitScript(() => {
    PublicKeyCredential.isConditionalMediationAvailable = async () => false;
  });
  await logOut(page);
  await page.reload();
  await passkeyButton(page).click();
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();

  await openSettings(page);
  await page.getByRole('button', { name: /Last used/ }).click();
  await page
    .getByRole('dialog', { name: 'Remove Passkey?' })
    .getByRole('button', { name: 'Remove', exact: true })
    .click();
  await expect(page.getByRole('button', { name: /Last used|Added/ })).toHaveCount(0);

  await logOut(page);
  await page.reload();
  await passkeyButton(page).click();
  await expect(page.getByRole('alert')).toContainText('Passkey not found');
  await expect(page).toHaveURL(/\/login$/);
});

test('Not Now hides the setup prompt on later logins', async ({ makeRower, browserName }) => {
  test.skip(browserName !== 'chromium', 'Needs a CDP virtual platform authenticator');
  const { page, context, user, password } = await makeRower();
  await addVirtualAuthenticator(context, page);
  await logOut(page);
  await passwordLogin(page, user.email, password);
  const offer = page.getByRole('dialog', { name: /^Log In with .+\?$/ });
  await offer.getByRole('button', { name: 'Not Now', exact: true }).click();
  await expect(offer).not.toBeVisible();
  await logOut(page);
  await passwordLogin(page, user.email, password);
  await expect(page.getByRole('heading', { name: 'This Week', exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(offer).toHaveCount(0);
});
