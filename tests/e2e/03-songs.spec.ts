import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA } from './helpers/auth';

test.describe('Songs Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsLeaderA(page);
  });

  test('Should list, view and interact with songs', async ({ page }, testInfo) => {
    // Go to Songs (Repertório)
    await page.click('text=Repertório');
    await page.waitForURL('**/songs**');
    
    // Check for seeded song
    await page.waitForSelector('text=Música Sintética');
    await captureFullPage(page, testInfo, 'songs-list');

    // Click on song to see detail
    await page.click('text=Música Sintética');
    await captureFullPage(page, testInfo, 'song-detail');
  });
});
