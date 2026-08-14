import { test, expect } from './helpers/base';
import { loginAsLeaderA } from './helpers/auth';
import type { Locator, Page } from '@playwright/test';

const readCachedScale = async (page: Page, scaleId: string) => page.evaluate((id) => {
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith('musicscale:music-data:v2:')) continue;
    try {
      const envelope = JSON.parse(localStorage.getItem(key) || 'null');
      const scale = envelope?.data?.populatedScales?.find((item: any) => item.id === id);
      if (scale) return scale;
    } catch {
      // Ignore unrelated/invalid storage entries and keep looking for the active cache.
    }
  }
  return null;
}, scaleId);

const activateTab = async (locator: Locator) => {
  await expect(locator).toBeVisible();
  // Wizard/tab controls live inside animated sheets. Dispatch the semantic click
  // after visibility so WebKit does not wait forever for CSS transform stability.
  await locator.dispatchEvent('click');
};

test.describe('Scale Song Persistence', () => {
  test.describe.configure({
    mode: 'serial',
    retries: 0
  });

  test('Líder ajusta tom e BPM na escala draft e verifica que não afeta o global', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const scaleId = `scale_song_persistence_${project}`;

    await loginAsLeaderA(page);
    await page.goto('/songs');
    await page.waitForURL('**/songs');
    const songItemBefore = page.getByTestId('song-card-song_a_2');
    await expect(songItemBefore).toBeVisible();
    await expect(songItemBefore.getByText('D', { exact: true })).toBeVisible();
    await expect(songItemBefore.getByText(/(?:BPM\s*90|90\s*BPM)/i)).toBeVisible();

    await page.goto(`/scales/${scaleId}`);
    await page.waitForURL(`**/scales/${scaleId}`);
    await expect(page.getByTestId('detail-song-card-song_a_2')).toBeVisible();

    const btnEditScale = page.getByTestId('edit-scale-detail-button');
    await expect(btnEditScale).toBeVisible();
    await btnEditScale.click();

    const scaleEditor = page.getByTestId('music-scale-modal');
    await expect(scaleEditor).toBeVisible();

    // The editor opens on Evento. Use the wizard's explicit Repertório tab so
    // settings are exercised on the real setlist representation, not its hidden
    // mounted copy.
    const repertoireStep = scaleEditor.getByRole('button', { name: 'Repertório', exact: true }).first();
    await expect(repertoireStep).toBeVisible();
    await activateTab(repertoireStep);

    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      // Inside MusicBuilder, mobile has its own Biblioteca/Repertório tabs.
      const builderTabs = scaleEditor.locator('div.md\\:hidden').filter({ hasText: /Repertório/ }).first();
      if (await builderTabs.isVisible().catch(() => false)) {
        const repertoireMobileTab = builderTabs.getByRole('button', { name: /Repertório/i }).last();
        await activateTab(repertoireMobileTab);
      }
    }

    const songCard = scaleEditor.locator('[data-song-id="song_a_2"][data-testid="scale-song-card-song_a_2"]');
    await expect(songCard).toBeVisible();

    const gearBtn = songCard.getByTestId('edit-scale-song-settings-song_a_2');
    await expect(gearBtn).toBeVisible();
    await gearBtn.click();

    const selectKey = songCard.getByTestId('scale-song-key-song_a_2');
    await expect(selectKey).toBeVisible();
    await selectKey.selectOption('G');

    const inputBpm = songCard.getByTestId('scale-song-bpm-song_a_2');
    await expect(inputBpm).toBeVisible();
    await inputBpm.fill('105');

    const scopeLocal = songCard.getByTestId('scale-song-scope-local-song_a_2');
    await expect(scopeLocal).toBeVisible();
    await scopeLocal.check();

    const applyBtn = songCard.getByTestId('save-scale-song-settings-song_a_2');
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();

    // Draft/publish controls are rendered only on the Revisão step.
    const reviewStep = scaleEditor.getByRole('button', { name: 'Revisão', exact: true }).first();
    await expect(reviewStep).toBeVisible();
    await activateTab(reviewStep);

    const saveScaleBtn = scaleEditor.getByTestId('save-scale-draft');
    await expect(saveScaleBtn).toBeVisible();
    await saveScaleBtn.click();
    await expect(scaleEditor).toBeHidden();

    // Closing the editor intentionally happens before the background refresh is
    // finished. Synchronize on the cache write that useMusicData performs only
    // after it has rebuilt populatedScales, instead of racing a second deep-link.
    await expect.poll(async () => {
      const cachedScale = await readCachedScale(page, scaleId);
      return {
        key: cachedScale?.songSettings?.song_a_2?.key,
        bpm: cachedScale?.songSettings?.song_a_2?.bpm,
      };
    }, { timeout: 15_000 }).toEqual({ key: 'G', bpm: 105 });

    // Exercise the real user path from the refreshed list. This avoids reopening
    // the same route before React Router/context have committed the new snapshot.
    const refreshedScaleCard = page.getByTestId(`scale-card-${scaleId}`);
    await expect(refreshedScaleCard).toBeVisible();
    await refreshedScaleCard.getByRole('heading', { level: 3 }).click();
    await expect(page.getByTestId('edit-scale-detail-button')).toBeVisible();

    const detailSongCard = page.getByTestId('detail-song-card-song_a_2');
    await expect(detailSongCard).toBeVisible();
    // Scope assertions to the value badges themselves. The BPM badge includes an
    // SVG before the numeric text, which produces leading whitespace in textContent.
    const localKeyValue = detailSongCard.locator('span').filter({ hasText: /^G(?:Ajuste local|Desta escala)$/i }).first();
    const localBpmValue = detailSongCard.locator('span').filter({ hasText: /105\s*(?:Ajuste local|Desta escala)/i }).first();
    await expect(localKeyValue).toBeVisible();
    await expect(localBpmValue).toBeVisible();

    const localBadges = detailSongCard.getByText(/Ajuste local|Desta escala/i);
    await expect(localBadges).toHaveCount(2);

    const viewChordsBtn = detailSongCard.getByTestId('performance-mode-button-song_a_2');
    await expect(viewChordsBtn).toBeVisible();
    await viewChordsBtn.click();

    // song_a_2 is intentionally incomplete and has no transposable chord body.
    // The durable scale override is already proven above as G/105; here we only
    // verify that Performance Mode opens successfully for that incomplete song.
    const closeBtn = page.getByTestId('close-chords-viewer');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    await page.goto('/songs');
    await page.waitForURL('**/songs');

    const songItemAfter = page.getByTestId('song-card-song_a_2');
    await expect(songItemAfter).toBeVisible();
    await expect(songItemAfter.getByText('D', { exact: true })).toBeVisible();
    await expect(songItemAfter.getByText(/(?:BPM\s*90|90\s*BPM)/i)).toBeVisible();
  });
});
