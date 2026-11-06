import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { test as base, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import type { User } from '../shared/types';
import { csrfHeaders, newRowerSignup } from './api';
import type { Bootstrap, RowerSignup } from './api';
import { completeSignup } from './helpers';

export interface Rower {
  page: Page;
  context: BrowserContext;
  user: User;
  password: string;
}
interface Fixtures {
  bootstrap: Bootstrap;
  adminPage: Page;
  makeRower: () => Promise<Rower>;
  newRowerSignup: () => Promise<RowerSignup>;
}
export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    if (process.env.E2E_MOCK === '1')
      await page.addInitScript(() => localStorage.setItem('oyo-mock-session', ''));
    await use(page);
  },
  bootstrap: async ({ baseURL }, use) => {
    expect(baseURL).toBeTruthy();
    const bootstrap: Bootstrap = JSON.parse(
      await readFile(new URL('./.auth/bootstrap.json', import.meta.url), 'utf8'),
    );
    test.skip(
      !bootstrap.backendReady,
      'POST /api/auth/signup returns 501; real-worker fixtures require backend PR #3',
    );
    await use(bootstrap);
  },
  adminPage: async ({ browser, bootstrap, baseURL }, use, testInfo) => {
    expect(bootstrap.backendReady).toBe(true);
    const context = await browser.newContext({
      ...testInfo.project.use,
      baseURL,
      storageState: fileURLToPath(new URL('./.auth/admin.json', import.meta.url)),
    });
    try {
      const page = await context.newPage();
      if (process.env.E2E_MOCK === '1') {
        await page.addInitScript(() => localStorage.setItem('oyo-mock-session', ''));
        await page.goto('/signup');
        await page.getByLabel('Team Join Code').waitFor();
      }
      await use(page);
    } finally {
      await context.close();
    }
  },
  newRowerSignup: async ({ adminPage, bootstrap }, use, testInfo) => {
    if (process.env.E2E_MOCK === '1') {
      await use(async () => {
        const response = await adminPage.evaluate(async (team_code) => {
          const result = await fetch('/api/auth/roster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-OYO-CSRF': '1' },
            body: JSON.stringify({ team_code }),
          });
          return { status: result.status, rows: await result.json() };
        }, bootstrap.teamCode);
        expect(response.status).toBe(200);
        const row = response.rows.find((row: { role: string }) => row.role === 'rower');
        expect(row).toBeTruthy();
        const email = `e2e+${randomUUID()}@example.com`,
          password = 'e2e-dev-rower-password-1';
        return {
          name: row.name,
          email,
          password,
          body: {
            email,
            password,
            team_code: bootstrap.teamCode,
            roster_id: row.id,
            group_key: 'normal',
          },
        };
      });
      return;
    }
    await use(() => newRowerSignup(adminPage.request, bootstrap, testInfo.project.name));
  },
  makeRower: async ({ browser, newRowerSignup, baseURL }, use, testInfo) => {
    const contexts: BrowserContext[] = [];
    await use(async () => {
      const context = await browser.newContext({ ...testInfo.project.use, baseURL });
      contexts.push(context);
      const signup = await newRowerSignup();
      const { body, password } = signup;
      if (process.env.E2E_MOCK === '1') {
        const page = await context.newPage();
        await page.addInitScript(() => localStorage.setItem('oyo-mock-session', ''));
        await page.goto('/signup');
        await completeSignup(page, signup, 'cardinal-oyo');
        const user: User = await page.evaluate(async () => {
          const response = await fetch('/api/me');
          if (!response.ok) throw new Error('Mock signup failed');
          return response.json();
        });
        return { context, page, user, password };
      }
      const response = await context.request.post('/api/auth/signup', {
        data: body,
        headers: csrfHeaders,
      });
      await expect(response).toBeOK();
      const user: User = await response.json();
      return { context, page: await context.newPage(), user, password };
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});
export { expect };
