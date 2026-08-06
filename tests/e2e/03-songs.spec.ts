import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA } from './helpers/auth';

test.describe('Songs Management', () => {
  test('Should list, view and interact with songs', async ({ page }, testInfo) => {
    await loginAsLeaderA(page);
    
    // Go to Songs (Repertório)
    await page.getByRole('link', { name: /Repertório|Músicas/i }).first().click();
    await page.waitForURL('**/songs');
    
    // Check for seeded song
    await expect(page.getByText('Música Sintética').first()).toBeVisible();
    await captureFullPage(page, testInfo, 'songs-list');

    // Click on song to see detail
    await page.getByText('Música Sintética').first().click();
    await expect(page.getByText('Artista Teste').first()).toBeVisible();
    await captureFullPage(page, testInfo, 'song-detail');
  });
});
