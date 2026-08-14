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

    const backButton = page.getByRole('button', { name: /Voltar|Fechar/i }).first();
    await expect(backButton).toBeVisible();
    await backButton.click();
    await page.waitForURL('**/scales');

    const createBtn = page.getByRole('button', { name: 'Criar', exact: true }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    // Desktop exposes a menuitem while mobile exposes a dialog button; exact
    // visible copy is unique in both variants.
    const newScaleAction = page.getByText('Criar escala de músicas', { exact: true });
    await expect(newScaleAction).toBeVisible();
    await newScaleAction.click();
    await expect(page.getByTestId('music-scale-modal')).toBeVisible();
    await captureFullPage(page, testInfo, 'scale-create');

    await page.getByTestId('music-scale-modal').getByRole('button', { name: /Cancelar/i }).first().click();
    await expect(page.getByTestId('music-scale-modal')).toBeHidden();
  });
});
