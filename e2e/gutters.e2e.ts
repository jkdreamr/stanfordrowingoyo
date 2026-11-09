import { writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { seedEntry, waitForSplash } from './helpers';

test.use({ serviceWorkers: 'block' });

async function measure(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('#main-content, .auth-frame')!;
    const title = root.querySelector<HTMLElement>('h1')!;
    const rootBox = root.getBoundingClientRect();
    const text = document.createRange();
    text.selectNodeContents(title);
    const titleBox = text.getBoundingClientRect();
    const visible = (node: Element) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return (
        box.width > 0 &&
        box.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        !['absolute', 'fixed'].includes(style.position) &&
        !node.matches('.social-refresh-slot, .sr-only')
      );
    };
    const auth = root.matches('.auth-frame');
    const game = /^\/games(?:\/|$)/.test(location.pathname);
    const wrapper = game ? root.querySelector<HTMLElement>('.ui-header-sentinel + div') : null;
    const body = auth
      ? title.closest('header')!.nextElementSibling!
      : wrapper
        ? Array.from(wrapper.children).find(visible)!
        : Array.from(
            root.querySelectorAll('.screen-stack > *, .me-flat > *, .ui-tabs, :scope > .ui-empty'),
          ).find(visible)!;
    if (!body) throw new Error(`Missing first content block: ${location.pathname}`);
    const bodyBox = body.getBoundingClientRect();
    const nav = root.querySelector<HTMLElement>('.ui-page-nav, .ui-task-header');
    const centered = !!title.closest('.ui-task-header');
    let contentX = bodyBox.left;
    if (wrapper)
      contentX =
        wrapper.getBoundingClientRect().left + parseFloat(getComputedStyle(wrapper).paddingLeft);
    else if (body.parentElement === root && body.matches('.ui-empty'))
      contentX += parseFloat(getComputedStyle(body).paddingLeft);
    const round = (value: number) => Math.round(value * 100) / 100;
    return {
      title: title.textContent,
      rootX: round(rootBox.left),
      titleInset: round(titleBox.left - rootBox.left),
      contentInset: round(contentX - rootBox.left),
      firstBlockInset: round(bodyBox.left - rootBox.left),
      navInset: nav
        ? round(
            nav.getBoundingClientRect().left +
              parseFloat(getComputedStyle(nav).paddingLeft) -
              rootBox.left,
          )
        : null,
      titleCenterDelta: round(
        titleBox.left + titleBox.width / 2 - rootBox.left - rootBox.width / 2,
      ),
      mode: centered ? 'centered-task-title' : auth ? 'auth' : 'left',
      gutter: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')),
      paddingTop: wrapper ? parseFloat(getComputedStyle(wrapper).paddingTop) : null,
    };
  });
}

test('page titles and content share their responsive gutters', async ({
  makeRower,
  adminPage,
  page: guest,
}, info) => {
  test.setTimeout(240_000);
  const rower = await makeRower();
  const entry = await seedEntry(rower, 'Gutter Audit');
  const desktop = info.project.name === 'desktop-chrome';
  const forced = desktop ? await makeRower() : null;
  if (forced) {
    const reset = await adminPage.request.post(
      `/api/admin/users/${forced.user.id}/reset-password`,
      { headers: csrfHeaders },
    );
    await expect(reset).toBeOK();
    const { temporary_password } = await reset.json();
    await expect(
      await forced.context.request.post('/api/auth/login', {
        headers: csrfHeaders,
        data: { email: forced.user.email, password: temporary_password },
      }),
    ).toBeOK();
  }
  const widths = desktop ? [1024, 1440] : [info.project.use.viewport!.width];
  const games = [
    '/games',
    '/games/leaderboard',
    '/games/wordguess',
    '/games/connections',
    '/games/perception',
    '/games/worldle',
    '/games/missing',
  ];
  const routes = desktop
    ? [
        '/',
        '/feed',
        '/leaderboard',
        '/me',
        '/plan',
        '/plan?tab=mine',
        '/plan?tab=guidance',
        '/plan?tab=menu',
        '/plan?tab=calculator',
        '/notifications',
        '/announcements',
        '/settings',
        '/me/edit',
        '/me/target',
        '/team',
        '/recap',
        '/log',
        `/entries/${entry.id}`,
        `/users/${rower.user.id}`,
        '/missing',
        ...games,
      ]
    : games;
  const results: ({ route: string; width: number } & Awaited<ReturnType<typeof measure>>)[] = [];
  const visit = async (surface: Page, route: string, width: number, label = route) => {
    await surface.setViewportSize({ width, height: 1000 });
    await surface.emulateMedia({ reducedMotion: 'reduce' });
    await surface.goto(route);
    await expect(surface.getByRole('heading', { level: 1 })).toBeVisible();
    await waitForSplash(surface);
    await expect(surface.locator('.ui-skeleton, .ui-spinner')).toHaveCount(0);
    await surface.evaluate(() => document.fonts.ready);
    const result = { route: label, width, ...(await measure(surface)) };
    results.push(result);
    console.log(`GUTTER ${JSON.stringify(result)}`);
    if (label === route && ['/games', '/games/leaderboard', '/games/wordguess'].includes(route))
      await surface.screenshot({
        path: info.outputPath(`${route.slice(1).replaceAll('/', '-')}-${width}.png`),
      });
  };
  for (const width of widths) {
    for (const route of routes) await visit(rower.page, route, width);
    if (desktop) {
      for (const route of [
        '/admin',
        '/admin/roster',
        '/admin/compliance',
        '/admin/settings',
        '/admin/presets',
        '/admin/plan',
        '/admin/announcements',
        '/admin/export',
        '/admin/audit',
        '/admin/reports',
        '/admin/challenges',
      ])
        await visit(adminPage, route, width);
      for (const route of ['/login', '/signup', '/privacy']) await visit(guest, route, width);
      await visit(rower.page, '/intro', width);
      await visit(forced!.page, '/change-password', width);
    }
    await rower.page.route('**/api/games', (route) =>
      route.fulfill({
        status: 503,
        json: { error: { code: 'UNAVAILABLE', message: 'Temporarily unavailable' } },
      }),
    );
    for (const route of ['/games', '/games/leaderboard']) {
      await visit(rower.page, route, width, `${route} (error)`);
      await expect(
        rower.page.getByText('Could Not Load This Screen', { exact: true }),
      ).toBeVisible();
    }
    await rower.page.unroute('**/api/games');
  }
  await writeFile(info.outputPath('gutters.json'), JSON.stringify(results, null, 2));
  for (const result of results) {
    const label = `${result.width} ${result.route}`;
    if (result.mode === 'centered-task-title')
      expect.soft(Math.abs(result.titleCenterDelta), label).toBeLessThanOrEqual(0.5);
    else
      expect
        .soft(Math.abs(result.titleInset - result.contentInset), label)
        .toBeLessThanOrEqual(0.5);
    if (result.mode !== 'auth') {
      expect.soft(result.contentInset, label).toBe(result.gutter);
      if (result.navInset !== null && result.mode !== 'centered-task-title')
        expect.soft(result.navInset, label).toBe(result.gutter);
    }
    if (result.paddingTop !== null)
      expect.soft(result.paddingTop, label).toBe(result.width >= 1024 ? 24 : 16);
  }
});
