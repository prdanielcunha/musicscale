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

    // Premium V2.1 intentionally has four destination links plus one centered
    // Create button. Account is available through the menu/header instead of a
    // fifth destination link in the compact dock.
    const links = nav.locator('a');
    await expect(links).toHaveCount(4);

    const painelLink = nav.getByRole('link', { name: 'Painel' });
    const musicasLink = nav.getByRole('link', { name: 'Músicas' });
    const escalasLink = nav.getByRole('link', { name: 'Escalas' });
    const bibliotecaLink = nav.getByRole('link', { name: 'Biblioteca' });
    const createBtn = nav.getByRole('button', { name: 'Criar', exact: true });

    await expect(painelLink).toBeVisible();
    await expect(musicasLink).toBeVisible();
    await expect(escalasLink).toBeVisible();
    await expect(bibliotecaLink).toBeVisible();
    await expect(createBtn).toBeVisible();

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

    await painelLink.click();
    await expect(page).toHaveURL(/.*\//);
    await expect(painelLink).toHaveAttribute('aria-current', 'page');

    const activeLinks = nav.locator('a[aria-current="page"]');
    await expect(activeLinks).toHaveCount(1);
    const activeIndicator = activeLinks.locator(':scope > div[aria-hidden="true"]');
    await expect(activeIndicator).toHaveCount(1);
    await expect(activeIndicator).toBeVisible();

    const createBox = await createBtn.boundingBox();
    expect(createBox).not.toBeNull();
    if (createBox && surfaceBox) {
      // Create lives inside the center slot of the dock surface.
      expect(createBox.x).toBeGreaterThanOrEqual(surfaceBox.x - 1);
      expect(createBox.x + createBox.width).toBeLessThanOrEqual(surfaceBox.x + surfaceBox.width + 1);
      expect(createBox.y).toBeGreaterThanOrEqual(surfaceBox.y - 1);
      expect(createBox.y + createBox.height).toBeLessThanOrEqual(surfaceBox.y + surfaceBox.height + 1);

      const surfaceCenterX = surfaceBox.x + surfaceBox.width / 2;
      const createCenterX = createBox.x + createBox.width / 2;
      expect(Math.abs(createCenterX - surfaceCenterX)).toBeLessThanOrEqual(surfaceBox.width / 10);
    }

    // Create follows the same expanded/compact rhythm as all four destinations.
    const scrollArea = page.locator('main');
    await scrollArea.evaluate(el => { el.scrollTop = 180; el.dispatchEvent(new Event('scroll')); });
    await expect(nav).toHaveAttribute('data-compact', 'true');
    await expect(createBtn.locator('span')).toHaveCSS('opacity', '0');
    await expect(createBtn.locator('span')).toHaveAttribute('aria-hidden', 'true');
    await expect(createBtn).toHaveCSS('height', '44px');
    for (const link of [painelLink, musicasLink, escalasLink, bibliotecaLink]) {
      await expect(link.locator('span')).toHaveCSS('opacity', '0');
    }
    const createDecoration = nav.getByTestId('mobile-create-highlight');
    expect(await createDecoration.evaluate(el => getComputedStyle(el, '::before').content)).toBe('none');

    // The compact icon retains its accessible name, touch target and dialog.
    await createBtn.click();
    await expect(page.getByRole('dialog', { name: 'Criar ou importar' })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Criar ou importar' })).not.toBeVisible();

    await scrollArea.evaluate(el => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')); });
    await expect(nav).toHaveAttribute('data-compact', 'false');
    await expect(createBtn.locator('span')).toHaveCSS('opacity', '1');
    await expect(createBtn).toHaveCSS('height', '50px');

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflowX).toBeFalsy();
  });
});
