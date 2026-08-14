import { test, expect } from './helpers/base';
import { loginAsMusicianA, loginAsObserverA } from './helpers/auth';

test.describe('Role Based Access Control', () => {
  test('Musician should not see admin settings', async ({ page, ignoreErrorPattern }) => {
    ignoreErrorPattern(/missing or insufficient permissions/);

    await loginAsMusicianA(page);
    await expect(page.getByRole('link', { name: /Configurações/i })).toBeHidden();
  });

  test('Observer should not be able to create scale', async ({ page, ignoreErrorPattern }) => {
    ignoreErrorPattern(/missing or insufficient permissions/);

    await loginAsObserverA(page);
    await page.goto('/scales');
    await page.waitForURL('**/scales');

    // The current create entry point is capability-driven and global. A visitor
    // must not receive the create trigger at all.
    await expect(page.getByRole('button', { name: 'Criar', exact: true })).toBeHidden();
  });
});
