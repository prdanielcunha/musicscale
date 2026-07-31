import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';

test.describe('Bootstrap and Adaptive Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login
    await page.goto('/');
    
    // Wait for Email login option and click
    await page.click('button:has-text("Acessar com e-mail")'); // Note: Make sure text matches
    
    // Fill login using standard email/password configured in globalSetup
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', 'leader@orga.test');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
  });

  test('Should load dashboard without errors and capture screenshot', async ({ page }) => {
    await page.waitForSelector('text=Família Teste A');
    
    // No white screen
    const bodyContent = await page.innerHTML('body');
    expect(bodyContent.length).toBeGreaterThan(100);
    
    await captureFullPage(page, test.info().project.name, 'dashboard-first-value');
  });
});
