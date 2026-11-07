import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function expectFocusedFieldAboveAction(page: Page, action: string, input: string) {
  const button = page.getByRole('button', { name: action, exact: true });
  const field = page.getByLabel(input, { exact: true });
  await field.focus();
  await expect(button).toBeInViewport({ ratio: 1 });
  await expect(field).toBeInViewport({ ratio: 1 });
  await expect
    .poll(async () => {
      const fieldBox = await field.boundingBox();
      const buttonBox = await button.boundingBox();
      return !!fieldBox && !!buttonBox && fieldBox.y + fieldBox.height <= buttonBox.y;
    })
    .toBe(true);
}

test('signup keeps Continue visible after selecting a roster name without scrolling to it', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === 'desktop-chrome')
    await page.setViewportSize({ width: 1280, height: 800 });
  await page.route('**/api/auth/roster', (route) =>
    route.fulfill({
      json: Array.from({ length: 40 }, (_, i) => ({
        id: `synthetic-${i}`,
        name: `Synthetic Rower ${String(i + 1).padStart(2, '0')}`,
        role: 'rower',
      })),
    }),
  );
  await page.goto('/signup');
  const action = page.getByRole('button', { name: 'Continue', exact: true });
  await expect(action).toBeInViewport({ ratio: 1 });
  await expect(action).toBeEnabled();
  await expect(action).toHaveCSS('opacity', '1');
  const enabledStyle = await action.evaluate((button) => ({
    background: getComputedStyle(button).backgroundColor,
    color: getComputedStyle(button).color,
  }));
  await page.getByLabel('Team Join Code').fill('local-demo-code');
  await action.click();
  await page.getByLabel('Search Names').fill('No Such Rower');
  await expect(page.getByText('No Matching Names', { exact: true })).toBeVisible();
  await expect(action).toBeDisabled();
  await expect(action).toBeInViewport({ ratio: 1 });
  await page.getByLabel('Search Names').fill('');
  await page.getByRole('radio', { name: 'Synthetic Rower 15', exact: true }).locator('..').click();
  await expect(action).toBeEnabled();
  await expect(action).toBeInViewport({ ratio: 1 });
  await expect(action).toHaveCSS('opacity', '1');
  await expect(action).toHaveCSS('background-color', enabledStyle.background);
  await expect(action).toHaveCSS('color', enabledStyle.color);
  await expect(page.locator('.auth-actions')).toHaveCSS('opacity', '1');
  if (testInfo.project.name === 'desktop-chrome') {
    const frame = await page.locator('.auth-frame').boundingBox();
    const bar = await page.locator('.auth-actions').boundingBox();
    expect(frame?.width).toBe(440);
    expect(frame?.x).toBe(420);
    expect(bar?.width).toBe(440);
    expect(bar?.x).toBe(420);
  }
  const lastName = page.getByRole('radio', { name: 'Synthetic Rower 40', exact: true });
  await lastName.locator('..').click();
  await expect(lastName).toBeChecked();
  await expect(lastName.locator('..')).toBeInViewport({ ratio: 1 });
  await expect(action).toBeInViewport({ ratio: 1 });
  const original = page.viewportSize()!;
  await page.setViewportSize({ width: original.width, height: 390 });
  await expectFocusedFieldAboveAction(page, 'Continue', 'Search Names');
  await action.click();
  await expect(action).toBeInViewport({ ratio: 1 });
  await action.click();
  await expectFocusedFieldAboveAction(page, 'Create Account', 'Email');
  await expectFocusedFieldAboveAction(page, 'Create Account', 'Password');
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(
    page.getByRole('alert').getByText('Enter a valid email address', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Account', exact: true })).toBeInViewport({
    ratio: 1,
  });
});

test('invite signup and login keep their actions above focused fields in a short viewport', async ({
  page,
}) => {
  await page.goto('/signup');
  await page.getByRole('button', { name: 'Have an Invite Email?', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create Account', exact: true })).toBeInViewport({
    ratio: 1,
  });
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 390 });
  await expectFocusedFieldAboveAction(page, 'Create Account', 'Email');
  await expectFocusedFieldAboveAction(page, 'Create Account', 'Password');
  await page.goto('/login');
  await expectFocusedFieldAboveAction(page, 'Log In', 'Email');
  await expectFocusedFieldAboveAction(page, 'Log In', 'Password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(
    page.getByRole('alert').getByText('Enter a valid email address', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log In', exact: true })).toBeInViewport({
    ratio: 1,
  });
});
