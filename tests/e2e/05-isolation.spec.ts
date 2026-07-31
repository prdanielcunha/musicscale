import { test, expect } from './helpers/base';
import { loginAsLeaderB } from './helpers/auth';

test.describe('Isolation between organizations', () => {
  test('User from Org B should not see Org A data', async ({ page, ignoreErrorPattern }) => {
    // Acesso negado pode gerar logs no Firebase SDK
    ignoreErrorPattern(/missing or insufficient permissions/);

    await loginAsLeaderB(page);

    await expect(page.getByText('Família Teste B').first()).toBeVisible();
    await expect(page.getByText('Família Teste A')).toBeHidden();

    // Verify Org A data is not visible in lists
    await page.goto('/songs');
    await expect(page.getByText('Música Sintética')).toBeHidden();

    await page.goto('/scales');
    await expect(page.getByText('Culto de Domingo')).toBeHidden();
    
    // Deep link check
    await page.goto('/scales/scale_a_published');
    
    // Should not reveal anything from Org A
    const content = await page.innerHTML('body');
    expect(content).not.toContain('Culto de Domingo');
  });
});
