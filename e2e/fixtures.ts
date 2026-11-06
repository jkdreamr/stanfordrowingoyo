import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import type { User } from '../shared/types';
import { csrfHeaders, newRowerSignup } from './api';
import type { Bootstrap, RowerSignup } from './api';

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
  bootstrap: async ({ baseURL }, use) => {
    expect(baseURL).toBeTruthy();
    const bootstrap: Bootstrap = JSON.parse(
      await readFile(new URL('./.auth/bootstrap.json', import.meta.url), 'utf8'),
    );
    test.skip(!bootstrap.backendReady, 'Backend API not implemented yet');
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
      await use(await context.newPage());
    } finally {
      await context.close();
    }
  },
  newRowerSignup: async ({ adminPage, bootstrap }, use, testInfo) => {
    await use(() => newRowerSignup(adminPage.request, bootstrap, testInfo.project.name));
  },
  makeRower: async ({ browser, newRowerSignup, baseURL }, use, testInfo) => {
    const contexts: BrowserContext[] = [];
    await use(async () => {
      const context = await browser.newContext({ ...testInfo.project.use, baseURL });
      contexts.push(context);
      const { body, password } = await newRowerSignup();
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
