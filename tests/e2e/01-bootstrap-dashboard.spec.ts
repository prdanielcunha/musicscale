import { test, expect } from './helpers/base';
import { captureFullPage } from './helpers/visualHelper';
import { loginAsLeaderA } from './helpers/auth';

test.describe('Bootstrap and Adaptive Dashboard', () => {
  test('Should load dashboard without errors and capture screenshot', async ({ page }, testInfo) => {
    await loginAsLeaderA(page);
    await captureFullPage(page, testInfo, 'dashboard-ready');
  });
});
