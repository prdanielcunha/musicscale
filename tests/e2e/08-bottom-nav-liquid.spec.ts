import { test, expect } from './helpers/base';
import { loginAsLeaderA } from './helpers/auth';

test.describe('BottomNav Liquid Glass', () => {
  test('Should render compact navigation with correct active state and smooth layout', async ({ page }) => {
    // iPad Mini is flagged as a mobile device by Playwright, but at 768px it is
    // intentionally on the product's md/sidebar layout. BottomNav itself is
    // md:hidden, so exercise this contract only below the actual breakpoint.
    const viewport = page.viewportSize();
    if (!viewport || viewport.width >= 768) test.skip();

    await loginAsLeaderA(page);

    const nav = page.locator('nav[aria-label="Navegação Principal"]');
    await expect(nav).toBeVisible();
    const links = nav.locator('a');
    await expect(links).toHaveCount(5);

    const painelLink = nav.getByRole('link', { name: 'Painel' });
    const musicasLink = nav.getByRole('link', { name: 'Músicas' });
    const escalasLink = nav.getByRole('link', { name: 'Escalas' });
    const bibliotecaLink = nav.getByRole('link', { name: 'Biblioteca' });
    const contaLink = nav.getByRole('link', { name: 'Conta' });

    await expect(painelLink).toBeVisible();
    await expect(musicasLink).toBeVisible();
    await expect(escalasLink).toBeVisible();
    await expect(bibliotecaLink).toBeVisible();
    await expect(contaLink).toBeVisible();

    const fontSizeStr = await painelLink.locator('span').evaluate((el) => window.getComputedStyle(el).fontSize);
    expect(parseFloat(fontSizeStr)).toBeGreaterThanOrEqual(10);

    const navSurface = nav.locator(':scope > div > div.pointer-events-auto.flex');
    const surfaceBox = await navSurface.boundingBox();
    expect(surfaceBox).not.toBeNull();
    if (surfaceBox) {
      expect(surfaceBox.height).toBeGreaterThanOrEqual(54);
      expect(surfaceBox.height).toBeLessThanOrEqual(62);
    }

    const itemBox = await painelLink.boundingBox();
    expect(itemBox).not.toBeNull();
    if (itemBox) {
      expect(itemBox.height).toBeGreaterThanOrEqual(48);
    }

    await musicasLink.click();
    await expect(page).toHaveURL(/.*\/songs/);
    await expect(musicasLink).toHaveAttribute('aria-current', 'page');

    await escalasLink.click();
    await expect(page).toHaveURL(/.*\/scales/);
    await expect(escalasLink).toHaveAttribute('aria-current', 'page');

    await bibliotecaLink.click();
    await expect(page).toHaveURL(/.*\/library/);
    await expect(bibliotecaLink).toHaveAttribute('aria-current', 'page');

    await contaLink.click();
    await expect(page).toHaveURL(/.*\/profile/);
    await expect(contaLink).toHaveAttribute('aria-current', 'page');

    await painelLink.click();
    await expect(page).toHaveURL(/.*\//);
    await expect(painelLink).toHaveAttribute('aria-current', 'page');

    const activeLinks = nav.locator('a[aria-current="page"]');
    await expect(activeLinks).toHaveCount(1);
    const activeIndicator = activeLinks.locator(':scope > div[aria-hidden="true"]');
    await expect(activeIndicator).toHaveCount(1);
    await expect(activeIndicator).toBeVisible();

    const createBtn = page.getByRole('button', { name: 'Criar', exact: true });
    const createBox = await createBtn.boundingBox();
    expect(createBox).not.toBeNull();
    if (createBox && surfaceBox) {
      expect(createBox.y + createBox.height).toBeLessThanOrEqual(surfaceBox.y);
    }

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflowX).toBeFalsy();
  });
});
