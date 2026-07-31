import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    
    page.on('pageerror', err => {
      errors.push(`PageError: ${err.message}`);
    });
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Allowlist
        if (text.includes('favicon.ico') || text.includes('third-party') || text.includes('FirebaseError: missing or insufficient permissions')) {
          return;
        }
        errors.push(`ConsoleError: ${text}`);
      }
    });

    page.on('requestfailed', request => {
      const url = request.url();
      if (url.includes('favicon.ico') || url.includes('google-analytics') || url.includes('font')) {
        return;
      }
      errors.push(`RequestFailed: ${url} - ${request.failure()?.errorText}`);
    });

    page.on('response', response => {
      if (response.status() === 500) {
        errors.push(`HTTP 500: ${response.url()}`);
      }
    });

    await use(page);

    const bodyText = await page.innerText('body').catch(() => '');
    if (bodyText.includes('undefined') || bodyText.includes('[object Object]')) {
      errors.push('Found "undefined" or "[object Object]" in page body.');
    }

    if (errors.length > 0) {
      throw new Error(`Errors detected during test:\n${errors.join('\n')}`);
    }
  }
});
export { expect } from '@playwright/test';
