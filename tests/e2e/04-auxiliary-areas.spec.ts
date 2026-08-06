import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA } from './helpers/auth';

test.describe('Auxiliary Areas and Account', () => {
  test('Should open Notifications', async ({ page }, testInfo) => {
    await loginAsLeaderA(page);
    await page.goto('/notifications');
    await expect(page.getByText('Nova notificação sintética').first()).toBeVisible();
    await captureFullPage(page, testInfo, 'notifications');
  });

  test('Should open Library', async ({ page }, testInfo) => {
    await loginAsLeaderA(page);
    await page.goto('/library');
    await page.waitForURL('**/library');
    await expect(page.getByText('Biblioteca').or(page.getByRole('heading', { name: /Biblioteca/i })).first()).toBeVisible();
    await captureFullPage(page, testInfo, 'library');
  });

  test('Should open Account Profile', async ({ page }, testInfo) => {
    await loginAsLeaderA(page);
    await page.goto('/profile');
    await expect(page.getByText('Líder Família A').first()).toBeVisible();
    await captureFullPage(page, testInfo, 'account-profile');
  });
});
