import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA, loginAsMusicianA } from './helpers/auth';

test.describe('Global Create Action', () => {
  test('Should show create action for authorized user and open form', async ({ page }, testInfo) => {
    await loginAsLeaderA(page);

    const createBtn = page.getByRole('button', { name: 'Criar', exact: true }).first();
    await expect(createBtn).toBeVisible();

    await createBtn.click();
    await expect(page.getByText('Criar ou importar', { exact: true }).first()).toBeVisible();

    const musicScaleAction = page.getByText('Criar escala de músicas', { exact: true });
    const bandScaleAction = page.getByText('Criar escala da banda', { exact: true });
    const manualSongAction = page.getByText('Adicionar manualmente', { exact: true });
    await expect(musicScaleAction).toBeVisible();
    await expect(bandScaleAction).toBeVisible();
    await expect(manualSongAction).toBeVisible();
    await captureFullPage(page, testInfo, 'global-create-menu-open');

    await musicScaleAction.click();
    await expect(page.getByTestId('music-scale-modal')).toBeVisible();

    await page.getByTestId('music-scale-modal').getByRole('button', { name: /Cancelar/i }).first().click();
    await expect(page.getByTestId('music-scale-modal')).toBeHidden();

    await page.goto('/scales');
    await expect(page.getByTestId('scale-card-scale_a_published')).toBeVisible();
  });

  test('Should not show create action for unauthorized user', async ({ page, ignoreErrorPattern }) => {
    ignoreErrorPattern(/missing or insufficient permissions/);
    await loginAsMusicianA(page);

    const createBtn = page.getByRole('button', { name: 'Criar', exact: true });
    await expect(createBtn).toBeHidden();
  });

  test('Mobile trigger should be positioned correctly above bottom nav and not intersect links', async ({ page, isMobile }) => {
    if (!isMobile) test.skip();
    await loginAsLeaderA(page);

    const createBtn = page.getByRole('button', { name: 'Criar', exact: true }).first();
    await expect(createBtn).toBeVisible();

    const escalasLink = page.getByRole('link', { name: /Escalas/i }).first();
    const contaLink = page.getByRole('link', { name: /Conta/i }).first();

    await expect(escalasLink).toBeVisible();
    await expect(contaLink).toBeVisible();

    const createBox = await createBtn.boundingBox();
    const navBox = await page.locator('.pointer-events-auto.flex.justify-between').first().boundingBox();
    const escalasBox = await escalasLink.boundingBox();
    const contaBox = await contaLink.boundingBox();

    expect(createBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(escalasBox).not.toBeNull();
    expect(contaBox).not.toBeNull();

    expect(createBox!.y + createBox!.height).toBeLessThanOrEqual(navBox!.y);

    const navCenterX = navBox!.x + (navBox!.width / 2);
    const createCenterX = createBox!.x + (createBox!.width / 2);
    expect(createCenterX).toBeGreaterThan(navCenterX);

    const intersect = (b1: NonNullable<typeof createBox>, b2: NonNullable<typeof escalasBox>) => {
      return !(b2.x >= b1.x + b1.width ||
               b2.x + b2.width <= b1.x ||
               b2.y >= b1.y + b1.height ||
               b2.y + b2.height <= b1.y);
    };

    expect(intersect(createBox!, escalasBox!)).toBeFalsy();
    expect(intersect(createBox!, contaBox!)).toBeFalsy();

    await expect(escalasLink).toBeEnabled();
    await expect(contaLink).toBeEnabled();

    const overflowX = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflowX).toBeFalsy();
  });
});
