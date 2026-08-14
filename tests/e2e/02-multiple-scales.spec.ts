import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA } from './helpers/auth';

test.describe('Multiple Scales', () => {
  test('Should show scales screen and interact', async ({ page }, testInfo) => {
    await loginAsLeaderA(page);

    // Navigation itself has dedicated coverage. This feature test enters the
    // canonical route directly so copy/sidebar variants cannot mask scale bugs.
    await page.goto('/scales');
    await page.waitForURL('**/scales');

    const publishedCard = page.getByTestId('scale-card-scale_a_published');
    const draftCard = page.getByTestId('scale-card-scale_a_draft');
    await expect(publishedCard).toBeVisible();
    await expect(draftCard).toBeVisible();

    await captureFullPage(page, testInfo, 'scales-list');

    // Click the title instead of the card center. The card intentionally contains
    // interactive song chips that stop propagation, and desktop/tablet center
    // coordinates can land on those controls instead of opening the scale.
    await publishedCard.locator('h3').click();
    await expect(page.getByTestId('edit-scale-detail-button')).toBeVisible();
    await expect(page.getByTestId('detail-song-card-song_a_1')).toBeVisible();
    await captureFullPage(page, testInfo, 'scale-detail');

    // The detail is a sheet/dialog over a backdrop. Click a guaranteed backdrop
    // point that sits outside the responsive sheet on both mobile and desktop.
    await page.mouse.click(10, 10);
    await expect(page.getByTestId('edit-scale-detail-button')).toBeHidden();

    const createBtn = page.getByRole('button', { name: 'Criar', exact: true }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    const palette = page.locator('#global-create-menu:visible, #global-create-dialog:visible');
    await expect(palette).toBeVisible();
    const newScaleAction = palette.locator('button').filter({ hasText: 'Criar escala de músicas' }).first();
    await expect(newScaleAction).toBeVisible();
    await newScaleAction.click();

    await expect(page.getByTestId('music-scale-modal')).toBeVisible();
    await captureFullPage(page, testInfo, 'scale-create');

    await page.getByTestId('music-scale-modal').getByRole('button', { name: /Cancelar/i }).first().click();
    await expect(page.getByTestId('music-scale-modal')).toBeHidden();
  });
});
