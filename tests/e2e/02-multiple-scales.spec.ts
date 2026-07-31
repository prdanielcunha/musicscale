import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA } from './helpers/auth';

test.describe('Multiple Scales', () => {
  test('Should show scales screen and interact', async ({ page }, testInfo) => {
    await loginAsLeaderA(page);
    
    // Go to Scales (Escalas)
    await page.getByRole('link', { name: /Escalas/i }).first().click();
    await page.waitForURL('**/scales');
    
    // Check for scales
    await expect(page.getByText('Culto de Domingo').first()).toBeVisible();
    await expect(page.getByText('Culto de Terça').first()).toBeVisible();

    await captureFullPage(page, testInfo, 'scales-list');

    // Click on a scale
    await page.getByText('Culto de Domingo').first().click();
    await expect(page.getByText('Culto Principal').first()).toBeVisible(); // Just a marker
    await captureFullPage(page, testInfo, 'scale-detail');

    // Go back
    await page.getByRole('button', { name: /Voltar/i }).first().click();
    await page.waitForURL('**/scales');

    // Create a new scale - opens modal/screen
    await page.getByRole('button', { name: /Nova Escala|Criar Escala/i }).first().click();
    await expect(page.getByRole('dialog').or(page.getByText(/Nova Escala|Criar Escala/i))).toBeVisible();
    await captureFullPage(page, testInfo, 'scale-create');
    
    // Close it
    await page.getByRole('button', { name: /Cancelar|Voltar|Fechar/i }).first().click();
  });
});
