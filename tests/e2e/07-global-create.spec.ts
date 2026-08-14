import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA, loginAsMusicianA } from './helpers/auth';

test.describe('Global Create Action', () => {
  test('Should show create action for authorized user and open form', async ({ page }, testInfo) => {
    await loginAsLeaderA(page);

    const createBtn = page.getByRole('button', { name: 'Criar', exact: true }).first();
    await expect(createBtn).toBeVisible();

    await createBtn.click();
    const palette = page.locator('#global-create-menu:visible, #global-create-dialog:visible');
    await expect(palette).toBeVisible();
    await expect(palette.getByText('Criar ou importar', { exact: true })).toBeVisible();

    const musicScaleAction = palette.locator('button').filter({ hasText: 'Criar escala de músicas' }).first();
    const bandScaleAction = palette.locator('button').filter({ hasText: 'Criar escala da banda' }).first();
    const manualSongAction = palette.locator('button').filter({ hasText: 'Adicionar manualmente' }).first();
    await expect(musicScaleAction).toBeVisible();
    await expect(bandScaleAction).toBeVisible();
    await expect(manualSongAction).toBeVisible();
    await captureFullPage(page, testInfo, 'global-create-menu-open');

    // Click the actual action control rather than the inner label. This waits on
    // the same interactive element that owns the pending-action/exit lifecycle.
    await musicScaleAction.click();
    await expect(page.getByTestId('music-scale-modal')).toBeVisible({ timeout: 10000 });

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

  test('Mobile trigger should be positioned correctly above bottom nav and not intersect links', async ({ page }) => {
    // Playwright marks iPad Mini as isMobile=true, but the product breakpoint is
    // Tailwind md (>= 768px), where BottomNav is intentionally hidden. Test the
    // actual rendered mobile layout rather than the browser-engine device flag.
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 768) test.skip();

    await loginAsLeaderA(page);

    const createBtn = page.getByRole('button', { name: 'Criar', exact: true }).first();
    await expect(createBtn).toBeVisible();

    const nav = page.locator('nav[aria-label="Navegação Principal"]');
    await expect(nav).toBeVisible();
    const escalasLink = nav.getByRole('link', { name: /Escalas/i });
    const contaLink = nav.getByRole('link', { name: /Conta/i });

    await expect(escalasLink).toBeVisible();
    await expect(contaLink).toBeVisible();

    const createBox = await createBtn.boundingBox();
    const navBox = await nav.locator('.pointer-events-auto.flex.justify-between').boundingBox();
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
