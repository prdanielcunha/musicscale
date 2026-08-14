import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA, loginAsMusicianA } from './helpers/auth';

test.describe('Global Create Sources (Paleta)', () => {
  test('Líder deve ver a paleta completa e interagir com fontes de criação', async ({ page, isMobile }, testInfo) => {
    await loginAsLeaderA(page);

    const createBtn = page.getByRole('button', { name: 'Criar', exact: true }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    const surfaceTitle = page.getByText('Criar ou importar', { exact: true }).first();
    await expect(surfaceTitle).toBeVisible();

    await expect(page.getByRole('group', { name: 'Músicas' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Escalas' })).toBeVisible();

    const aiAction = page.getByText('Importar com IA', { exact: true });
    const libraryAction = page.getByText('Buscar na Biblioteca Viva', { exact: true });
    const manualAction = page.getByText('Adicionar manualmente', { exact: true });
    await expect(aiAction).toBeVisible();
    await expect(libraryAction).toBeVisible();
    await expect(manualAction).toBeVisible();
    await captureFullPage(page, testInfo, 'global-create-sources');

    await aiAction.click();
    await expect(page.getByText(/Importar Música com Inteligência Artificial|Importar Música/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Cancelar|Fechar/i }).first().click();

    await createBtn.click();
    await expect(surfaceTitle).toBeVisible();
    await page.getByText('Buscar na Biblioteca Viva', { exact: true }).click();
    await expect(page).toHaveURL(/.*\/library/);
    await expect(page.getByPlaceholder(/Buscar por música/i)).toBeFocused();

    await page.goto('/');
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await expect(surfaceTitle).toBeVisible();
    await page.getByText('Adicionar manualmente', { exact: true }).click();
    await expect(page.getByText('Nova Música', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: /Cancelar|Fechar/i }).first().click();

    if (isMobile) {
      await createBtn.click();
      await expect(surfaceTitle).toBeVisible();
      await page.mouse.click(10, 10);
      await expect(surfaceTitle).toBeHidden();

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
