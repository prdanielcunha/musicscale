import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA } from './helpers/auth';

test('Release news opens on demand and stays acknowledged', async ({ page }, testInfo) => {
  await loginAsLeaderA(page);
  const notice = page.getByRole('button', { name: /Conhecer novidades/ });
  await expect(notice).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await notice.click();
  const dialog = page.getByRole('dialog', { name: 'Mais espaço para a música.' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Como funciona', { exact: true })).toHaveCount(3);
  await expect(dialog.getByText(/Versão instalada/)).toBeVisible();
  await captureFullPage(page, testInfo, 'release-news-beta');
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).first().click();
  await expect(dialog).toBeHidden();
  await expect(notice).toBeHidden();
  await page.reload();
  await expect(page.locator('main').getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(notice).toBeHidden();
});
