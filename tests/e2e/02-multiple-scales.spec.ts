import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA } from './helpers/auth';

test.describe('Multiple Scales', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsLeaderA(page);
  });

  test('Should show scales screen and interact', async ({ page }, testInfo) => {
    // Go to Scales (Escalas)
    await page.click('text=Escalas');
    await page.waitForURL('**/scales**');
    
    // There should be Culto de Domingo and Culto de Terça
    await page.waitForSelector('text=Culto de Domingo');
    await page.waitForSelector('text=Culto de Terça');

    await captureFullPage(page, testInfo, 'scales-list');

    // Click on a scale
    await page.click('text=Culto de Domingo');
    await captureFullPage(page, testInfo, 'scale-detail');

    // Go back
    await page.click('button[aria-label="Voltar"], a[href="/scales"]');
    await page.waitForURL('**/scales**');

    // Create a new scale - opens modal/screen
    // Try to find the button
    await page.click('button:has-text("Criar Escala"), button:has-text("Nova Escala"), button[aria-label="Nova Escala"], button[aria-label="Criar Escala"]');
    await page.waitForTimeout(500); // Wait for modal
    await captureFullPage(page, testInfo, 'scale-create');
    
    // Close it
    await page.locator('button:has-text("Cancelar"), button:has-text("Voltar"), button[aria-label="Fechar"]').first().click();
  });
});
