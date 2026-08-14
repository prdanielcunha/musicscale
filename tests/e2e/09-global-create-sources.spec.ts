import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA, loginAsMusicianA } from './helpers/auth';

test.describe('Global Create Sources (Paleta)', () => {
  test('Líder deve ver a paleta completa e interagir com fontes de criação', async ({ page }, testInfo) => {
    await loginAsLeaderA(page);

    const createBtn = page.getByRole('button', { name: 'Criar', exact: true }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    const palette = page.locator('#global-create-menu:visible, #global-create-dialog:visible');
    await expect(palette).toBeVisible();

    await expect(palette.getByRole('group', { name: 'Músicas' })).toBeVisible();
    await expect(palette.getByRole('group', { name: 'Escalas' })).toBeVisible();

    // Scope action locators to the create palette. The dashboard also has an
    // educational "Importar com IA" card, so a page-wide text locator is
    // intentionally ambiguous and not a valid action contract.
    const aiAction = palette.locator('button').filter({ hasText: 'Importar com IA' }).first();
    const libraryAction = palette.locator('button').filter({ hasText: 'Buscar na Biblioteca Viva' }).first();
    const manualAction = palette.locator('button').filter({ hasText: 'Adicionar manualmente' }).first();
    await expect(aiAction).toBeVisible();
    await expect(libraryAction).toBeVisible();
    await expect(manualAction).toBeVisible();
    await captureFullPage(page, testInfo, 'global-create-sources');

    await aiAction.click();
    const aiTextarea = page.locator('textarea[name="rawText"]').first();
    await expect(aiTextarea).toBeVisible();

    // AiSongImportModal uses the shared role=dialog Modal. Close the exact
    // dialog that owns rawText and wait for it to disappear before reopening the
    // global palette; a page-wide Cancel/Close locator races the overlay in WebKit.
    const aiDialog = page.getByRole('dialog').filter({ has: aiTextarea });
    await expect(aiDialog).toBeVisible();
    await aiDialog.getByRole('button', { name: 'Close modal' }).click();
    await expect(aiDialog).toBeHidden();

    await createBtn.click();
    await expect(palette).toBeVisible();
    await palette.locator('button').filter({ hasText: 'Buscar na Biblioteca Viva' }).first().click();
    await expect(page).toHaveURL(/.*\/library/);
    await expect(page.getByPlaceholder(/Buscar por música/i)).toBeFocused();

    await page.goto('/');
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await expect(palette).toBeVisible();
    await palette.locator('button').filter({ hasText: 'Adicionar manualmente' }).first().click();

    const newSongTitle = page.getByText('Nova Música', { exact: true }).first();
    await expect(newSongTitle).toBeVisible();
    const manualDialog = page.getByRole('dialog').filter({ has: newSongTitle }).first();
    await expect(manualDialog).toBeVisible();
    const manualClose = manualDialog.getByRole('button', { name: /Close modal|Cancelar|Fechar/i }).first();
    await expect(manualClose).toBeVisible();
    await manualClose.click();
    await expect(manualDialog).toBeHidden();

    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      await createBtn.click();
      await expect(palette).toBeVisible();
      await page.mouse.click(10, 10);
      await expect(palette).toBeHidden();

      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflowX).toBeFalsy();
    }
  });

  test('Usuário sem capability não vê a paleta', async ({ page, ignoreErrorPattern }) => {
    ignoreErrorPattern(/missing or insufficient permissions/);
    await loginAsMusicianA(page);

    const createBtn = page.getByRole('button', { name: 'Criar', exact: true }).first();
    await expect(createBtn).toBeHidden();
  });
});
