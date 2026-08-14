import { test, expect } from './helpers/base';
import { loginAsLeaderA } from './helpers/auth';

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
    await repertoireStep.click();

    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      // Inside MusicBuilder, mobile has its own Biblioteca/Repertório tabs.
      const builderTabs = scaleEditor.locator('div.md\\:hidden').filter({ hasText: /Repertório/ }).first();
      if (await builderTabs.isVisible().catch(() => false)) {
        const repertoireMobileTab = builderTabs.getByRole('button', { name: /Repertório/i }).last();
        await repertoireMobileTab.click();
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
    await reviewStep.click();

    const saveScaleBtn = scaleEditor.getByTestId('save-scale-draft');
    await expect(saveScaleBtn).toBeVisible();
    await saveScaleBtn.click();
    await expect(scaleEditor).toBeHidden();

    // base.ts waits for BrowserRouter to commit each internal route before the
    // next goto, so the ScalesPage deep-link guard can reset deterministically.
    await page.goto('/scales');
    await expect(page.getByRole('heading', { name: 'Escalas Musicais' })).toBeVisible();
    await page.goto(`/scales/${scaleId}`);
    await expect(page.getByTestId('edit-scale-detail-button')).toBeVisible();

    const detailSongCard = page.getByTestId('detail-song-card-song_a_2');
    await expect(detailSongCard).toBeVisible();
    // The current detail card renders the value together with its semantic label
    // (for example "Tom G" / "BPM 105") rather than as an isolated text node.
    await expect(detailSongCard).toContainText(/Tom\s*G/i);
    await expect(detailSongCard).toContainText(/(?:BPM\s*105|105\s*BPM)/i);

    const localBadges = detailSongCard.getByText(/Ajuste local|Desta escala/i);
    await expect(localBadges).toHaveCount(2);

    const viewChordsBtn = detailSongCard.getByTestId('performance-mode-button-song_a_2');
    await expect(viewChordsBtn).toBeVisible();
    await viewChordsBtn.click();

    const tomLabel = page.getByText('Tom', { exact: true });
    await expect(tomLabel).toBeVisible();

    const transposedKey = page.getByTestId('chords-viewer-transposed-key');
    await expect(transposedKey).toBeVisible();
    await expect(transposedKey).toHaveText('G');

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
