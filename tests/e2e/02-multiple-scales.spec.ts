import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';

test.describe('Multiple Scales', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Acessar com e-mail")');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', 'leader@orga.test');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
  });

  test('Should show scales screen and interact', async ({ page }) => {
    // Go to Scales (Escalas)
    await page.click('a[href="/scales"]');
    await page.waitForURL('**/scales**');
    await page.waitForSelector('text=Escalas');

    await captureFullPage(page, test.info().project.name, 'scales-list');

    // Make sure we can see upcoming scales
    const scalesCount = await page.locator('.scale-card, [data-testid="scale-card"]').count();
    // Because we seeded a future scale, it should exist, or at least the empty state should be valid

    // Create a new scale - opens modal/screen
    // we assume there's a create button, let's look for standard terms
    // "Nova", "Criar", "Adicionar"
    await page.click('button:has-text("Nova"), button:has-text("Criar")');
    await captureFullPage(page, test.info().project.name, 'scale-create');
    
    // Close it
    await page.click('button:has-text("Cancelar"), button:has-text("Voltar")');
  });
});
