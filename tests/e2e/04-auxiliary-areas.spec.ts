import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA } from './helpers/auth';

test.describe('Auxiliary Areas and Account', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsLeaderA(page);
  });

  test('Should open Notifications', async ({ page }, testInfo) => {
    await page.goto('/notifications');
    await page.waitForTimeout(500); // Allow render
    await page.waitForSelector('text=Nova notificação sintética');
    await captureFullPage(page, testInfo, 'notifications');
  });

  test('Should open Library', async ({ page }, testInfo) => {
    // If there's a bottom nav, click the icon, or just navigate
    await page.goto('/library');
    await page.waitForURL('**/library**');
    await captureFullPage(page, testInfo, 'library');
  });

  test('Should open Account Profile', async ({ page }, testInfo) => {
    await page.goto('/profile');
    await page.waitForTimeout(1000);
    await captureFullPage(page, testInfo, 'account-profile');
  });
});
