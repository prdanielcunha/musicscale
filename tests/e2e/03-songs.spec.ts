import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';

test.describe('Songs Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Acessar com e-mail")');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', 'leader@orga.test');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
  });

  test('Should list, view and interact with songs', async ({ page }) => {
    // Go to Songs (Repertório)
    await page.click('a[href="/songs"]');
    await page.waitForURL('**/songs**');
    
    // Check for seeded song
    await page.waitForSelector('text=Música Sintética');
    await captureFullPage(page, test.info().project.name, 'songs-list');

    // Click on song to see detail
    await page.click('text=Música Sintética');
    await captureFullPage(page, test.info().project.name, 'song-detail');
  });
});
