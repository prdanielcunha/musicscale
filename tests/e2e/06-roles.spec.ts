import { test, expect } from './helpers/base';
import { loginAsMusicianA, loginAsObserverA } from './helpers/auth';

test.describe('Role Based Access Control', () => {
  test('Musician should not see admin settings', async ({ page, ignoreErrorPattern }) => {
    ignoreErrorPattern(/missing or insufficient permissions/);
    
    await loginAsMusicianA(page);
    
    // Admin settings typically not visible to standard member
    // Example: general settings link
    await expect(page.getByRole('link', { name: /Configurações/i })).toBeHidden();
  });

  test('Observer should not be able to create scale', async ({ page, ignoreErrorPattern }) => {
    ignoreErrorPattern(/missing or insufficient permissions/);
    
    await loginAsObserverA(page);
    
    await page.goto('/scales');
    // Create button should not be visible or should be disabled
    const createBtn = page.getByRole('button', { name: /Nova Escala|Criar Escala/i }).first();
    const isVisible = await createBtn.isVisible();
    if (isVisible) {
      await expect(createBtn).toBeDisabled();
    }
  });
});
