import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA } from './helpers/auth';

test('Relevant release auto-opens once and can be reopened manually', async ({ page }, testInfo) => {
  await loginAsLeaderA(page);

  const dialog = page.getByRole('dialog', { name: 'O palco ganhou seu próprio espaço.' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Como funciona', { exact: true })).toHaveCount(3);
  await expect(dialog.getByText('Leia mais — correções e refinamentos', { exact: true })).toBeVisible();
  await expect(dialog.getByText('0.2.0-beta.0')).toHaveCount(0);
  await captureFullPage(page, testInfo, 'release-news-stage-tools-beta');

  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(dialog).toBeHidden();

  const stored = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('musicscale_release_seen:'))
      .map((key) => localStorage.getItem(key)),
  );
  expect(stored).toContain('stage-tools-beta-0.2');

  await page.goto('/songs');
  await expect(page.locator('header').getByRole('heading', { name: 'Repertório' })).toBeVisible();
  await page.goto('/');
  await expect(page.locator('main').getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.locator('header').getByRole('button', { name: /Atualizações/ }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByText('Leia mais — correções e refinamentos', { exact: true }).click();
  await expect(dialog.getByText('Reutilização de formações de banda vinculadas ficou mais segura.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
});
