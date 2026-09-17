import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA } from './helpers/auth';
import { FEATURE_RELEASE } from '../../lib/appRelease';
import { releaseNewsTranslations } from '../../locales/releaseNews';

const releaseKey = FEATURE_RELEASE.translationKey.replace(
  'releaseNews.',
  '',
) as keyof typeof releaseNewsTranslations.pt;
const currentRelease = releaseNewsTranslations.pt[releaseKey];

test('Relevant release auto-opens once and can be reopened manually', async ({ page }, testInfo) => {
  await loginAsLeaderA(page, { preserveReleaseNews: true });

  const dialog = page.getByRole('dialog', { name: currentRelease.title });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Como funciona', { exact: true })).toHaveCount(3);
  await expect(dialog.getByText(currentRelease.refinements.summary, { exact: true })).toBeVisible();
  await expect(dialog.getByText(FEATURE_RELEASE.version, { exact: true })).toHaveCount(0);
  await captureFullPage(page, testInfo, 'release-news-current-feature');

  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(dialog).toBeHidden();

  const stored = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('musicscale_release_seen:'))
      .map((key) => localStorage.getItem(key)),
  );
  expect(stored).toContain(FEATURE_RELEASE.id);

  await page.goto('/songs');
  await expect(page.locator('header').getByRole('heading', { name: 'Repertório' })).toBeVisible();
  await page.goto('/');
  await expect(page.locator('main').getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // The header shortcut is intentionally hidden below sm. On phones, use
  // the same main-menu entry a user uses to reopen an already-seen release.
  if ((page.viewportSize()?.width ?? 1440) < 640) {
    await page.locator('header').getByRole('button', { name: 'Menu Principal', exact: true }).click();
    await page.getByRole('link', { name: 'Novidades', exact: true }).click();
  } else {
    await page.locator('header').getByRole('button', { name: 'Novidades', exact: true }).click();
  }
  await expect(dialog).toBeVisible();
  await dialog.getByText(currentRelease.refinements.summary, { exact: true }).click();
  await expect(dialog.getByText(currentRelease.refinements.items[0].text, { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
});
