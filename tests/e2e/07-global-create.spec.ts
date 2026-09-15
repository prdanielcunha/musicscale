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

  test('Mobile trigger should be centered in bottom nav and not intersect destination links', async ({ page }) => {
    // Playwright marks iPad Mini as isMobile=true, but the product breakpoint is
    // Tailwind md (>= 768px), where BottomNav is intentionally hidden. Test the
    // actual rendered mobile layout rather than the browser-engine device flag.
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 768) test.skip();

    await loginAsLeaderA(page);

    const nav = page.locator('nav[aria-label="Navegação Principal"]');
    await expect(nav).toBeVisible();

    // Premium V2.1 uses four destination links plus the centered Create action.
    // Account remains available through the menu/header and is intentionally not
    // duplicated in the compact mobile dock.
    const links = nav.locator('a');
    await expect(links).toHaveCount(4);

    const musicasLink = nav.getByRole('link', { name: /Músicas/i });
    const escalasLink = nav.getByRole('link', { name: /Escalas/i });
    const createBtn = nav.getByRole('button', { name: 'Criar', exact: true });

    await expect(musicasLink).toBeVisible();
    await expect(escalasLink).toBeVisible();
    await expect(createBtn).toBeVisible();

    const createBox = await createBtn.boundingBox();
    const navBox = await nav.locator(':scope > div > div.pointer-events-auto.flex').boundingBox();
    const musicasBox = await musicasLink.boundingBox();
    const escalasBox = await escalasLink.boundingBox();

    expect(createBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(musicasBox).not.toBeNull();
    expect(escalasBox).not.toBeNull();

    // The Create action is the center slot of the same dock surface, not a
    // floating control above it. Keep it fully contained and centered.
    expect(createBox!.x).toBeGreaterThanOrEqual(navBox!.x - 1);
    expect(createBox!.x + createBox!.width).toBeLessThanOrEqual(navBox!.x + navBox!.width + 1);
    expect(createBox!.y).toBeGreaterThanOrEqual(navBox!.y - 1);
    expect(createBox!.y + createBox!.height).toBeLessThanOrEqual(navBox!.y + navBox!.height + 1);

    const navCenterX = navBox!.x + (navBox!.width / 2);
    const createCenterX = createBox!.x + (createBox!.width / 2);
    expect(Math.abs(createCenterX - navCenterX)).toBeLessThanOrEqual(navBox!.width / 10);

    const intersect = (b1: NonNullable<typeof createBox>, b2: NonNullable<typeof musicasBox>) => {
      return !(b2.x >= b1.x + b1.width ||
               b2.x + b2.width <= b1.x ||
               b2.y >= b1.y + b1.height ||
               b2.y + b2.height <= b1.y);
    };

    expect(intersect(createBox!, musicasBox!)).toBeFalsy();
    expect(intersect(createBox!, escalasBox!)).toBeFalsy();

    await expect(musicasLink).toBeEnabled();
    await expect(escalasLink).toBeEnabled();

    const overflowX = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflowX).toBeFalsy();
  });
});
