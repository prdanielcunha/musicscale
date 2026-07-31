import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';

test.describe('Auxiliary Areas and Account', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Acessar com e-mail")');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', 'leader@orga.test');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
  });

  test('Should open Notifications', async ({ page }) => {
    // Usually a bell icon
    await page.click('a[href="/notifications"], button[aria-label*="Notifica"]');
    await page.waitForTimeout(500); // Allow render
    await captureFullPage(page, test.info().project.name, 'notifications');
  });

  test('Should open Library', async ({ page }) => {
    await page.click('a[href="/library"]');
    await page.waitForURL('**/library**');
    await captureFullPage(page, test.info().project.name, 'library');
  });

  test('Should open Account Profile', async ({ page }) => {
    await page.click('a[href="/profile"], a[href="/account"]');
    await page.waitForTimeout(1000);
    await captureFullPage(page, test.info().project.name, 'account');
  });
});
