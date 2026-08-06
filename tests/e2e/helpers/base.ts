import { test as base } from '@playwright/test';

type TestFixtures = {
  ignoreErrorPattern: (pattern: RegExp) => void;
};

export const test = base.extend<TestFixtures>({
  ignoreErrorPattern: async ({ page }, use) => {
    let patterns: RegExp[] = [];
    await use((pattern: RegExp) => patterns.push(pattern));
    (page as any)._ignoredPatterns = patterns;
  },
  page: async ({ page }, use) => {
    const errors: string[] = [];
    (page as any)._ignoredPatterns = [];
    
    page.on('pageerror', err => {
      errors.push(`PageError: ${err.message}`);
    });
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        const ignoredPatterns = (page as any)._ignoredPatterns as RegExp[];
        const ignored = ignoredPatterns && ignoredPatterns.some(p => p.test(text));
        if (!ignored) {
          errors.push(`ConsoleError: ${text}`);
        }
      }
    });

    page.on('requestfailed', request => {
      const url = request.url();
      const failure = request.failure();
      // "blockedbyclient" comes from our network mock rejecting external
      if (failure && failure.errorText !== 'net::ERR_BLOCKED_BY_CLIENT' && failure.errorText !== 'net::ERR_ABORTED') {
        errors.push(`RequestFailed: ${url} - ${failure.errorText}`);
      }
    });

    page.on('response', response => {
      if (response.status() >= 500) {
        errors.push(`HTTP ${response.status()}: ${response.url()}`);
      }
    });

    await use(page);

    const bodyText = await page.innerText('body').catch(() => '');
    if (bodyText.includes('undefined') || bodyText.includes('[object Object]')) {
      errors.push('Found "undefined" or "[object Object]" in page body.');
    }
    
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });
    if (overflow) {
      errors.push('Horizontal overflow detected.');
    }

    if (errors.length > 0) {
      throw new Error(`Errors detected during test:\n${errors.join('\n')}`);
    }
  }
});
export { expect } from '@playwright/test';
