import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA, loginAsMusicianA } from './helpers/auth';

test.describe('Global Create Action', () => {
  test('Should show create action for authorized user and open form', async ({ page }, testInfo) => {
    await loginAsLeaderA(page);
    
    const createBtn = page.getByRole('button', { name: 'Criar' }).first();
    await expect(createBtn).toBeVisible();
    
    // Open menu
    await createBtn.click();
    await expect(page.getByRole('menu').or(page.getByRole('dialog', { name: /Criar/i }))).toBeVisible();
    await expect(page.getByText('Escala de músicas')).toBeVisible();
    await expect(page.getByText('Escala da banda')).toBeVisible();
    await expect(page.getByText('Música')).toBeVisible();

    await captureFullPage(page, testInfo, 'global-create-menu-open');
    
    // Click on Music Scale
    await page.getByText('Escala de músicas').click();
    
    // Modal should appear
    await expect(page.getByText('Nova Escala').or(page.getByRole('dialog', { name: /Nova Escala/ }))).toBeVisible();
    
    // Close modal
    await page.getByRole('button', { name: /Cancelar|Fechar/ }).first().click();
    
    // Check no extra scale created (just a safe check)
    await page.goto('/scales');
    await expect(page.getByText('Culto de Domingo').first()).toBeVisible();
  });

  test('Should not show create action for unauthorized user', async ({ page, ignoreErrorPattern }) => {
    ignoreErrorPattern(/missing or insufficient permissions/);
    await loginAsMusicianA(page);
    
    const createBtn = page.getByRole('button', { name: 'Criar' });
    await expect(createBtn).toBeHidden();
  });
});
