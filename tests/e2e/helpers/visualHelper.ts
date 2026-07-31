import { Page, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

export async function captureFullPage(page: Page, testName: string, screenshotName: string) {
  // Ensure network is idle and animations finish
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  
  // Create test-results/visual-evidence folder if not exists
  const evidenceDir = path.join(process.cwd(), 'test-results', 'visual-evidence', testName);
  fs.mkdirSync(evidenceDir, { recursive: true });

  const screenshotPath = path.join(evidenceDir, `${screenshotName}.png`);
  
  await page.screenshot({ 
    path: screenshotPath, 
    fullPage: true,
    animations: 'disabled'
  });
}
