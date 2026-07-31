import fs from 'fs';

let content = fs.readFileSync('tests/e2e/07-global-create.spec.ts', 'utf8');

const newTest = `
  test('Mobile trigger should be positioned correctly above bottom nav and not intersect links', async ({ page, isMobile }) => {
    if (!isMobile) test.skip();
    await loginAsLeaderA(page);
    
    const createBtn = page.getByRole('button', { name: 'Criar' }).first();
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
    
    // Positioned above the nav bar
    expect(createBox.y + createBox.height).toBeLessThanOrEqual(navBox.y);
    
    // Positioned to the right of the center
    const navCenterX = navBox.x + (navBox.width / 2);
    const createCenterX = createBox.x + (createBox.width / 2);
    expect(createCenterX).toBeGreaterThan(navCenterX);
    
    const intersect = (b1, b2) => {
      return !(b2.x >= b1.x + b1.width || 
               b2.x + b2.width <= b1.x || 
               b2.y >= b1.y + b1.height ||
               b2.y + b2.height <= b1.y);
    };
    
    expect(intersect(createBox, escalasBox)).toBeFalsy();
    expect(intersect(createBox, contaBox)).toBeFalsy();
    
    await expect(escalasLink).toBeEnabled();
    await expect(contaLink).toBeEnabled();
    
    const overflowX = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflowX).toBeFalsy();
  });
});`;

content = content.replace(/}\);\n}\);\n*$/, newTest);

fs.writeFileSync('tests/e2e/07-global-create.spec.ts', content);
