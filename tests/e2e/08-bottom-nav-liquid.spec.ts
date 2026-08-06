import { test, expect } from './helpers/base';
import { loginAsLeaderA } from './helpers/auth';

test.describe('BottomNav Liquid Glass', () => {
  test('Should render compact navigation with correct active state and smooth layout', async ({ page, isMobile }) => {
    if (!isMobile) test.skip();
    await loginAsLeaderA(page);
    
    // 1. & 2. Confirm the 5 links
    const links = page.locator('nav[aria-label="Navegação Principal"] a');
    await expect(links).toHaveCount(5);

    const painelLink = page.getByRole('link', { name: 'Painel' });
    const musicasLink = page.getByRole('link', { name: 'Músicas' });
    const escalasLink = page.getByRole('link', { name: 'Escalas' });
    const bibliotecaLink = page.getByRole('link', { name: 'Biblioteca' });
    const contaLink = page.getByRole('link', { name: 'Conta' });
    
    // 3. Confirm 5 labels are visible
    await expect(painelLink).toBeVisible();
    await expect(musicasLink).toBeVisible();
    await expect(escalasLink).toBeVisible();
    await expect(bibliotecaLink).toBeVisible();
    await expect(contaLink).toBeVisible();

    // 4. & 5. Check font-size is at least 10px
    const fontSizeStr = await painelLink.locator('span').evaluate((el) => {
      return window.getComputedStyle(el).fontSize;
    });
    const fontSize = parseFloat(fontSizeStr);
    expect(fontSize).toBeGreaterThanOrEqual(10);
    
    // 6. & 7. boundingBox of the surface (~54px to 62px height)
    const navSurface = page.locator('nav[aria-label="Navegação Principal"] > div > div.pointer-events-auto.flex');
    const surfaceBox = await navSurface.boundingBox();
    expect(surfaceBox).not.toBeNull();
    if (surfaceBox) {
      expect(surfaceBox.height).toBeGreaterThanOrEqual(54);
      expect(surfaceBox.height).toBeLessThanOrEqual(62);
    }
    
    // 8. & 9. boundingBox of each link, min height 48px
    const itemBox = await painelLink.boundingBox();
    expect(itemBox).not.toBeNull();
    if (itemBox) {
      expect(itemBox.height).toBeGreaterThanOrEqual(48);
    }
    
    // 11-13. Click Músicas, confirm route & active
    await musicasLink.click();
    await expect(page).toHaveURL(/.*\/songs/);
    await expect(musicasLink).toHaveAttribute('aria-current', 'page');
    
    // 14-16. Click Escalas, confirm route & active
    await escalasLink.click();
    await expect(page).toHaveURL(/.*\/scales/);
    await expect(escalasLink).toHaveAttribute('aria-current', 'page');
    
    // 17-19. Click Biblioteca, confirm route & active
    await bibliotecaLink.click();
    await expect(page).toHaveURL(/.*\/library/);
    await expect(bibliotecaLink).toHaveAttribute('aria-current', 'page');
    
    // 20-22. Click Conta, confirm route & active
    await contaLink.click();
    await expect(page).toHaveURL(/.*\/profile/);
    await expect(contaLink).toHaveAttribute('aria-current', 'page');
    
    // 23-24. Back to Painel
    await painelLink.click();
    await expect(page).toHaveURL(/.*\//);
    await expect(painelLink).toHaveAttribute('aria-current', 'page');
    
    // 25. Check there is only one indicator
    const indicators = page.locator('[aria-hidden="true"]');
    await expect(indicators).toHaveCount(1);
    
    // 26 & 27. Indicator inside the active link
    // By checking that it exists within the active link
    const activeIndicator = painelLink.locator('[aria-hidden="true"]');
    await expect(activeIndicator).toBeVisible();

    // 28 & 29. Check Create button does not intersect nav bar
    const createBtn = page.getByRole('button', { name: 'Criar' });
    const createBox = await createBtn.boundingBox();
    expect(createBox).not.toBeNull();
    if (createBox && surfaceBox) {
      // Must be above
      expect(createBox.y + createBox.height).toBeLessThanOrEqual(surfaceBox.y);
    }
    
    // 30. No horizontal overflow
    const overflowX = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });
    expect(overflowX).toBeFalsy();
  });
});
