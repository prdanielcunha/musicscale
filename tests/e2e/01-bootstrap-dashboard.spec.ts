import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA } from './helpers/auth';

test.describe('Bootstrap and Adaptive Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsLeaderA(page);
  });

  test('Should load dashboard without errors and capture screenshot', async ({ page }, testInfo) => {
    await page.waitForSelector('text=Família Teste A');
    
    // No white screen
    const bodyContent = await page.innerHTML('body');
    expect(bodyContent.length).toBeGreaterThan(100);
    
    await captureFullPage(page, testInfo, 'dashboard-ready');
  });
});
