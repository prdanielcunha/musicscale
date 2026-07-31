import { test, expect } from './helpers/base';
import { loginAsLeaderB } from './helpers/auth';

test.describe('Isolation between organizations', () => {
  test('User from Org B should not see Org A data', async ({ page }) => {
    await loginAsLeaderB(page);

    // Should see Org B name
    await page.waitForSelector('text=Família Teste B');
    
    // Should NOT see Org A name
    const orgAText = await page.locator('text=Família Teste A').count();
    expect(orgAText).toBe(0);

    // Deep link check: user B trying to access scale from Org A
    // We seeded 'scale_future' for Org A
    await page.goto('/scales/scale_future');
    
    await page.waitForTimeout(1000);
    const content = await page.innerHTML('body');
    // Ensure it doesn't show the scale title "Culto de Domingo" from Org A
    expect(content).not.toContain('Culto de Domingo');
  });
});
