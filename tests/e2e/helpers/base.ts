import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', err => {
      errors.push(err.message);
    });
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('third-party')) {
        errors.push(msg.text());
      }
    });

    await use(page);

    if (errors.length > 0) {
      throw new Error(`Console errors or page errors detected:\n${errors.join('\n')}`);
    }
  }
});
export { expect } from '@playwright/test';
