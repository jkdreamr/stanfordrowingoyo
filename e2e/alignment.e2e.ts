import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { csrfHeaders } from './api';
import { seedEntry, waitForSplash } from './helpers';

test.use({ serviceWorkers: 'block' });
test.skip(process.env.E2E_MOCK === '1', 'The alignment sweep uses real-worker fixtures');

const sizes = [
  { name: 'android-small', width: 360, height: 800, project: 'pixel-7' },
  { name: 'iphone-se', width: 375, height: 667, project: 'iphone-15' },
  { name: 'iphone-15', width: 393, height: 852, project: 'iphone-15' },
  { name: 'iphone-pro-max', width: 430, height: 932, project: 'iphone-15' },
  { name: 'pixel-7', width: 412, height: 915, project: 'pixel-7' },
  { name: 'desktop', width: 1440, height: 1000, project: 'desktop-chrome' },
];

async function geometry(page: Page) {
  return page.evaluate(() => {
    const issues: string[] = [];
    const visible = (node: Element) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return (
        box.width > 0 &&
        box.height > 0 &&
        style.visibility !== 'hidden' &&
        style.clip !== 'rect(0px, 0px, 0px, 0px)'
      );
    };
    const center = (node: Element) => {
      const box = node.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    };
    const near = (a: number, b: number, label: string, tolerance = 2) => {
      if (Math.abs(a - b) > tolerance) issues.push(`${label}: ${a.toFixed(2)} vs ${b.toFixed(2)}`);
    };
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
      issues.push(
        `page overflow: ${document.documentElement.scrollWidth}/${document.documentElement.clientWidth}`,
      );
    const nav = document.querySelector('.shell-tabbar');
    let tabs: { center: number; width: number; labelBottom: number }[] = [];
    if (nav && visible(nav)) {
      const box = nav.getBoundingClientRect();
      const style = getComputedStyle(nav);
      const left = box.left + parseFloat(style.paddingLeft);
      const width = box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      tabs = Array.from(nav.children).map((tab, i) => {
        const target = tab.getBoundingClientRect();
        const label = tab.lastElementChild!.getBoundingClientRect();
        near(center(tab).x, left + ((i + 0.5) * width) / 5, `tab ${i} center`, 1);
        near(target.width, width / 5, `tab ${i} width`, 1);
        if (target.width < 44 || target.height < 44) issues.push(`tab ${i} target below 44px`);
        return { center: center(tab).x, width: target.width, labelBottom: label.bottom };
      });
      near(tabs[2].center, window.innerWidth / 2, 'Log screen center', 1);
      for (const tab of tabs) near(tab.labelBottom, tabs[0].labelBottom, 'tab label baseline', 1);
    }
    for (const empty of Array.from(document.querySelectorAll('.ui-empty'))) {
      if (!visible(empty)) continue;
      for (const child of Array.from(empty.children))
        near(center(child).x, center(empty).x, 'empty-state child center');
      const style = getComputedStyle(empty);
      near(
        parseFloat(style.paddingTop),
        parseFloat(style.paddingBottom),
        'empty-state vertical padding',
        1,
      );
    }
    for (const title of Array.from(document.querySelectorAll('h1, h2, h3'))) {
      if (!visible(title) || getComputedStyle(title).textAlign !== 'center') continue;
      const range = document.createRange();
      range.selectNodeContents(title);
      const text = range.getBoundingClientRect();
      near(text.left + text.width / 2, center(title).x, `centered heading ${title.textContent}`);
      if (title.parentElement)
        near(center(title).x, center(title.parentElement).x, 'heading container center');
    }
    for (const header of Array.from(
      document.querySelectorAll('.ui-page-nav, .ui-task-header, .ui-sheet-header > div'),
    )) {
      if (!visible(header)) continue;
      const buttons = Array.from(header.querySelectorAll('.ui-icon-button')).filter(visible);
      for (const button of buttons) {
        if (buttons[0]) near(center(button).y, center(buttons[0]).y, 'header icon row');
        near(center(button).y, center(header).y, 'header icon container row');
        const icon = button.querySelector('svg');
        if (icon) {
          near(center(icon).x, center(button).x, 'header icon horizontal center', 1);
          near(center(icon).y, center(button).y, 'header icon vertical center', 1);
        }
      }
      const compact = header.querySelector('.ui-page-compact');
      if (compact && Number(getComputedStyle(compact).opacity) === 1)
        near(center(compact).x, center(header).x, 'compact heading center');
      const heading = header.querySelector('h1');
      if (heading && header.matches('.ui-page-nav-inline, .ui-task-header'))
        near(center(heading).y, center(header).y, 'header heading row');
      if (heading && header.matches('.ui-task-header'))
        near(center(heading).x, center(header).x, 'task heading center');
    }
    for (const element of Array.from(
      document.querySelectorAll('h1,h2,h3,p,label,button,a,.shell-tabbar span'),
    )) {
      if (!(element instanceof HTMLElement) || !visible(element)) continue;
      const style = getComputedStyle(element);
      // Explicit truncation and scrollable tabs are deliberate disclosure patterns.
      if (
        style.textOverflow === 'ellipsis' ||
        parseInt(style.getPropertyValue('-webkit-line-clamp'), 10) > 0 ||
        ['auto', 'scroll'].includes(style.overflowX)
      )
        continue;
      if (
        ['hidden', 'clip'].includes(style.overflowX) &&
        element.scrollWidth > element.clientWidth + 2
      )
        issues.push(`clipped text: ${element.textContent?.trim().slice(0, 70)}`);
      if (
        ['hidden', 'clip'].includes(style.overflowY) &&
        element.scrollHeight > element.clientHeight + 2
      )
        issues.push(`vertically clipped text: ${element.textContent?.trim().slice(0, 70)}`);
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (
        !node.textContent?.trim() ||
        !parent ||
        !visible(parent) ||
        parent.closest('script,style,svg,.sr-only,[aria-hidden="true"]')
      )
        continue;
      let ancestor: HTMLElement | null = parent;
      let scrollable = false;
      while (ancestor) {
        const style = getComputedStyle(ancestor);
        if (style.textOverflow === 'ellipsis' || ['auto', 'scroll'].includes(style.overflowX))
          scrollable = true;
        ancestor = ancestor.parentElement;
      }
      if (scrollable) continue;
      const range = document.createRange();
      range.selectNode(node);
      const rect = range.getBoundingClientRect();
      if (
        rect.width &&
        rect.height &&
        (rect.left < -2 || rect.right > document.documentElement.clientWidth + 2)
      )
        issues.push(`text outside viewport: ${node.textContent.trim().slice(0, 70)}`);
    }
    for (const sheet of Array.from(document.querySelectorAll('dialog[open]'))) {
      near(center(sheet).x, window.innerWidth / 2, 'sheet center', 1);
      const box = sheet.getBoundingClientRect();
      if (box.left < -1 || box.right > window.innerWidth + 1) issues.push('sheet outside viewport');
    }
    return { issues, tabs };
  });
}

for (const size of sizes) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`alignment sweep ${size.name} ${scheme}`, async ({
      makeRower,
      adminPage,
      page: guest,
      newRowerSignup,
      bootstrap,
    }, info) => {
      test.skip(
        info.project.name !== size.project,
        'Each matrix size has a designated browser project',
      );
      test.setTimeout(240_000);
      const rower = await makeRower();
      const { page } = rower;
      const root = process.env.E2E_ALIGNMENT_DIR ?? info.outputPath('alignment');
      const directory = join(root, `${size.name}-${scheme}`);
      await mkdir(directory, { recursive: true });
      const results: {
        screen: string;
        issues: string[];
        tabs: { center: number; width: number; labelBottom: number }[];
      }[] = [];
      for (const surface of [page, adminPage, guest]) {
        await surface.setViewportSize({ width: size.width, height: size.height });
        await surface.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await surface.addInitScript(() => localStorage.setItem('theme', 'system'));
      }
      const capture = async (surface: Page, screen: string) => {
        await waitForSplash(surface);
        await expect(surface.locator('.ui-skeleton, .ui-spinner')).toHaveCount(0);
        await surface.evaluate(() => document.fonts.ready);
        await surface.screenshot({ path: join(directory, `${screen}.png`) });
        if (screen.startsWith('home-'))
          await surface.screenshot({ path: join(directory, `${screen}-viewport.png`) });
        results.push({ screen, ...(await geometry(surface)) });
      };
      const visit = async (surface: Page, route: string, screen: string) => {
        await surface.goto(route);
        await expect(surface.getByRole('heading', { level: 1 })).toBeVisible();
        await capture(surface, screen);
      };
      await visit(page, '/', 'home-empty');
      if (size.width < 1024) {
        const bar = (await page.locator('.shell-tabbar').boundingBox())!;
        await page.screenshot({
          path: join(directory, 'tabbar.png'),
          clip: { x: bar.x, y: bar.y - 8, width: bar.width, height: bar.height + 8 },
        });
      }
      await visit(page, '/feed', 'feed-empty');
      await visit(page, '/notifications', 'notifications-empty');
      await visit(page, '/plan?tab=mine', 'my-fortnight-empty');
      await page.getByRole('button', { name: 'Start Plan', exact: true }).click();
      await capture(page, 'start-plan-sheet');
      await page.getByRole('button', { name: 'Start Blank', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Week 1', exact: true })).toBeVisible();
      await capture(page, 'my-fortnight');
      await page
        .getByRole('button', { name: /^Add Session / })
        .first()
        .click();
      await capture(page, 'plan-session-sheet');
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await visit(page, '/', 'home-plan-empty');
      await page.route('**/api/me/plan**', (route) =>
        route.fulfill({
          status: 503,
          json: { error: { code: 'UNAVAILABLE', message: 'Temporarily unavailable' } },
        }),
      );
      await page.reload();
      await expect(page.getByText('Could Not Load Your Plan', { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await capture(page, 'home-plan-error');
      await page.unroute('**/api/me/plan**');
      const entry = await seedEntry(rower, 'Morning steady state');
      for (const [route, name] of [
        ['/feed', 'feed'],
        ['/log', 'log'],
        ['/leaderboard', 'leaderboard'],
        ['/me', 'me'],
        ['/plan', 'plan'],
        ['/plan?tab=guidance', 'plan-guide'],
        ['/plan?tab=menu', 'plan-workouts'],
        ['/plan?tab=calculator', 'plan-calculator'],
        ['/announcements', 'announcements'],
        ['/announcements?announcement=missing', 'announcement-removed'],
        [`/entries/${entry.id}`, 'entry-detail'],
        [`/users/${rower.user.id}`, 'rower-profile'],
        ['/team', 'team'],
        ['/settings', 'settings'],
        ['/privacy', 'privacy'],
        ['/me/edit', 'edit-profile'],
        ['/me/target', 'weekly-target'],
        ['/recap', 'recap'],
      ])
        await visit(page, route, name);
      await page.goto('/me');
      await page.getByRole('button', { name: 'Add Test', exact: true }).click();
      await capture(page, 'erg-test-sheet');
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      const announcement = await adminPage.request.post('/api/announcements', {
        headers: csrfHeaders,
        data: {
          title: 'Saturday crew session',
          body: 'Meet at the boathouse at 6:15. Bring your water bottle.',
          pinned: false,
        },
      });
      await expect(announcement).toBeOK();
      const { id: announcementId } = (await announcement.json()) as { id: string };
      await visit(page, `/announcements?announcement=${announcementId}`, 'announcement-detail');
      await visit(page, '/notifications', 'notifications');
      await adminPage.request.delete(`/api/announcements/${announcementId}`, {
        headers: csrfHeaders,
      });
      await visit(page, '/feed', 'feed-collapsed-header');
      await page.evaluate(() => window.scrollTo(0, 150));
      await capture(page, 'feed-scrolled-header');
      await page.goto(`/entries/${entry.id}`);
      await page.getByRole('button', { name: 'More', exact: true }).click();
      await capture(page, 'workout-actions-sheet');
      await page.getByRole('button', { name: 'Delete Workout', exact: true }).click();
      await capture(page, 'delete-workout-dialog');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.goto('/settings');
      await page.getByRole('button', { name: 'Change Password', exact: true }).click();
      await capture(page, 'password-sheet');
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Log Out', exact: true }).click();
      await capture(page, 'logout-dialog');
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.goto('/intro');
      for (let step = 1; step <= 3; step++) {
        await capture(page, `onboarding-${step}`);
        if (step < 3) await page.getByRole('button', { name: 'Continue', exact: true }).click();
      }
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
        await visit(adminPage, route, route.slice(1).replaceAll('/', '-'));
      await adminPage.goto('/admin/roster');
      await adminPage.getByRole('button', { name: 'Add Name', exact: true }).click();
      await capture(adminPage, 'admin-roster-sheet');
      await adminPage.getByRole('button', { name: 'Close', exact: true }).click();
      await adminPage.getByRole('button', { name: 'Import CSV', exact: true }).click();
      await capture(adminPage, 'admin-import-sheet');
      await adminPage.getByRole('button', { name: 'Close', exact: true }).click();
      await adminPage.goto('/admin/announcements');
      await adminPage.getByLabel('New Announcement', { exact: true }).click();
      await capture(adminPage, 'admin-announcement-sheet');
      await adminPage.getByRole('button', { name: 'Close', exact: true }).click();
      await adminPage.goto('/admin/presets');
      await adminPage.getByRole('button', { name: 'Add Preset', exact: true }).click();
      await capture(adminPage, 'admin-preset-sheet');
      await adminPage.getByRole('button', { name: 'Close', exact: true }).click();
      await adminPage.goto('/admin/challenges');
      await adminPage.getByRole('button', { name: 'New Challenge', exact: true }).click();
      await capture(adminPage, 'admin-challenge-sheet');
      await adminPage.getByRole('button', { name: 'Close', exact: true }).click();
      await visit(guest, '/login', 'login');
      const signup = await newRowerSignup();
      await visit(guest, '/signup', 'signup-code');
      await guest.getByLabel('Team Join Code').fill(bootstrap.teamCode);
      await guest.getByRole('button', { name: 'Continue', exact: true }).click();
      await capture(guest, 'signup-name');
      await guest.getByRole('radio', { name: signup.name, exact: true }).locator('..').click();
      await guest.getByRole('button', { name: 'Continue', exact: true }).click();
      await capture(guest, 'signup-group');
      await guest
        .getByRole('radio', { name: 'Normal Non-Frosh', exact: true })
        .locator('..')
        .click();
      await guest.getByRole('button', { name: 'Continue', exact: true }).click();
      await capture(guest, 'signup-account');
      await rower.context.request.patch('/api/me', {
        data: { best2k_split_s: 110 },
        headers: csrfHeaders,
      });
      await page.goto('/log');
      await page.getByLabel('Meters', { exact: true }).fill('2000');
      await page.getByRole('button', { name: 'Add Details', exact: true }).click();
      await page.getByLabel('Split /500m', { exact: true }).fill('1:38.2');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'New 2k Best' })).toBeVisible();
      await capture(page, 'celebration');
      await writeFile(join(directory, 'geometry.json'), JSON.stringify(results, null, 2));
      expect(
        results.flatMap(({ screen, issues }) => issues.map((issue) => `${screen}: ${issue}`)),
      ).toEqual([]);
    });
  }
}
