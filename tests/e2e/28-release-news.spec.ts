import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA } from './helpers/auth';
import { releaseNewsTranslations } from '../../locales/releaseNews';

const releaseSource = fs.readFileSync(path.join(process.cwd(), 'lib/appRelease.ts'), 'utf8');
const releaseMatch = releaseSource.match(/id:\s*['"]([^'"]+)['"]/);
if (!releaseMatch?.[1]) throw new Error('Missing FEATURE_RELEASE.id');
const releaseId = releaseMatch[1];

const copy = releaseNewsTranslations.pt;
const currentRelease = copy.nestTunerBeta010;

test('Permanent tuner, pad and medley highlights survive acknowledgment and hotfix history remains collapsed', async ({ page }, testInfo) => {
  await loginAsLeaderA(page, { preserveReleaseNews: true });

  const dialog = page.getByRole('dialog', { name: copy.pinned.title });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: copy.pinned.tuner })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: copy.pinned.pad })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: copy.pinned.medley })).toBeVisible();
  await expect(dialog.getByText('Como funciona', { exact: true })).toHaveCount(3);
  await expect(dialog.getByText(copy.pinned.otherUpdates, { exact: true })).toBeVisible();
  await expect(dialog.getByText(currentRelease.refinements.items[0].text, { exact: true })).toBeHidden();
  await expect(dialog.getByRole('link', { name: copy.viewFeature })).toHaveCount(3);
  await captureFullPage(page, testInfo, 'release-news-pinned-features');

  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(dialog).toBeHidden();

  const stored = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('musicscale_release_seen:'))
      .map((key) => localStorage.getItem(key)),
  );
  expect(stored).toContain(releaseId);

  await page.goto('/songs');
  await expect(page.locator('header').getByRole('heading', { name: 'Repertório' })).toBeVisible();
  await page.goto('/');
  await expect(page.locator('main').getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('dialog')).toHaveCount(0);

  if ((page.viewportSize()?.width ?? 1440) < 640) {
    await page.locator('header').getByRole('button', { name: 'Menu Principal', exact: true }).click();
    await page.getByRole('link', { name: 'Novidades', exact: true }).click();
  } else {
    await page.locator('header').getByRole('button', { name: 'Novidades', exact: true }).click();
  }

  // Dismissing a release may suppress auto-open, never the permanent content.
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('pinned-release-tuner')).toBeVisible();
  await expect(dialog.getByTestId('pinned-release-pad')).toBeVisible();
  await expect(dialog.getByTestId('pinned-release-medley')).toBeVisible();
  await dialog.getByText(copy.pinned.otherUpdates, { exact: true }).click();
  await expect(dialog.getByText(currentRelease.refinements.items[0].text, { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();

  // The full Updates page must also show the pinned milestones even if the
  // dynamic /api/changelog request fails or returns no entries.
  await page.goto('/updates');
  await expect(page.getByRole('heading', { name: copy.pinned.tuner })).toBeVisible();
  await expect(page.getByRole('heading', { name: copy.pinned.pad })).toBeVisible();
  await expect(page.getByRole('heading', { name: copy.pinned.medley })).toBeVisible();
});
