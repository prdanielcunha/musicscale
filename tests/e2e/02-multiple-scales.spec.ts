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

    await publishedCard.click();
    await expect(page.getByTestId('edit-scale-detail-button')).toBeVisible();
    await expect(page.getByTestId('detail-song-card-song_a_1')).toBeVisible();
    await captureFullPage(page, testInfo, 'scale-detail');

    // Close the detail surface using its deterministic close/back control.
    const backButton = page.getByRole('button', { name: /Voltar|Fechar/i }).first();
    await expect(backButton).toBeVisible();
    await backButton.click();
    await page.waitForURL('**/scales');

    // Open creation through the global create contract and assert the real form.
    const createBtn = page.getByRole('button', { name: 'Criar', exact: true }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    const newScaleAction = page.getByRole('menuitem', { name: /Criar escala de músicas/i });
    await expect(newScaleAction).toBeVisible();
    await newScaleAction.click();
    await expect(page.getByTestId('music-scale-modal')).toBeVisible();
    await captureFullPage(page, testInfo, 'scale-create');

    await page.getByTestId('music-scale-modal').getByRole('button', { name: /Cancelar/i }).first().click();
    await expect(page.getByTestId('music-scale-modal')).toBeHidden();
  });
});
