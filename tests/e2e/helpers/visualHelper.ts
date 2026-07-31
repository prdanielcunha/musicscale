import { Page, TestInfo } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

export async function captureFullPage(page: Page, testInfo: TestInfo, screenshotName: string) {
  // Ensure network is idle and animations finish by waiting for dom to be ready
  await page.evaluate(() => document.fonts.ready);
  
  // Disable animations via CSS
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
      }
    `
  });
  
  // Create test-results/visual-evidence folder if not exists
  const evidenceDir = path.join(process.cwd(), 'test-results', 'visual-evidence', testInfo.project.name);
  fs.mkdirSync(evidenceDir, { recursive: true });

  const screenshotPath = path.join(evidenceDir, `${screenshotName}.png`);
  
  await page.screenshot({ 
    path: screenshotPath, 
    fullPage: true,
    animations: 'disabled'
  });

  if (!fs.existsSync(screenshotPath)) {
    throw new Error(`Screenshot not found at ${screenshotPath}`);
  }

  testInfo.attach(screenshotName, {
    path: screenshotPath,
    contentType: 'image/png'
  });
}
