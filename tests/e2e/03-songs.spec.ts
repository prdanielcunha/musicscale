import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA } from './helpers/auth';

test.describe('Songs Management', () => {
  test('Should list, view and interact with songs', async ({ page }, testInfo) => {
    await loginAsLeaderA(page);

    // Navigation has dedicated coverage; enter the canonical feature route directly.
    await page.goto('/songs');
    await page.waitForURL('**/songs');

    const songCard = page.getByTestId('song-card-song_a_1');
    await expect(songCard).toBeVisible();
    await expect(songCard.getByText('Música Sintética', { exact: true })).toBeVisible();
    await captureFullPage(page, testInfo, 'songs-list');

    await songCard.click();
    await expect(page.getByText('Artista Teste', { exact: true }).first()).toBeVisible();
    await captureFullPage(page, testInfo, 'song-detail');
  });
});
