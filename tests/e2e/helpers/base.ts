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
    (page as any)._musicscaleClientNavigationReady = false;

    // Once loginAs() proves that the private workspace is fully hydrated, keep
    // feature-route navigation inside the already-running SPA. A hard page.goto
    // after login tears down the hydrated providers, restarts Firestore listeners,
    // and can cancel Vite lazy imports in WebKit, which the product ErrorBoundary
    // correctly interprets as a chunk-load failure. Authentication itself still
    // uses the native Playwright navigation because this flag stays false until
    // the login helper explicitly enables client-side navigation.
    const nativeGoto = page.goto.bind(page);
    const nativeWaitForURL = page.waitForURL.bind(page);

    const globToRegExp = (glob: string) => {
      let pattern = '^';
      for (let i = 0; i < glob.length; i += 1) {
        const char = glob[i];
        if (char === '*') {
          if (glob[i + 1] === '*') {
            pattern += '.*';
            i += 1;
          } else {
            pattern += '[^/]*';
          }
        } else if (char === '?') {
          pattern += '.';
        } else {
          pattern += char.replace(/[\\^$+?.()|{}[\]]/g, '\\$&');
        }
      }
      pattern += '$';
      return new RegExp(pattern);
    };

    const currentUrlMatches = (matcher: any) => {
      const href = page.url();
      if (!href) return false;

      if (typeof matcher === 'function') {
        try {
          return Boolean(matcher(new URL(href)));
        } catch {
          return false;
        }
      }

      if (matcher instanceof RegExp) {
        const lastIndex = matcher.lastIndex;
        const matched = matcher.test(href);
        matcher.lastIndex = lastIndex;
        return matched;
      }

      if (typeof matcher === 'string') {
        return globToRegExp(matcher).test(href);
      }

      return false;
    };

    // Playwright waitForURL observes *future* navigations. Our SPA goto below has
    // already committed history.pushState before it returns, so a legacy pattern
    // like `await page.goto('/scales'); await page.waitForURL('**/scales')` must
    // be idempotent when the current URL already matches. Otherwise Playwright
    // waits 30 seconds for a second navigation that will never happen.
    (page as any).waitForURL = async (url: any, options?: any) => {
      if ((page as any)._musicscaleClientNavigationReady === true) {
        if (currentUrlMatches(url)) return;

        return nativeWaitForURL(url, {
          ...options,
          waitUntil: options?.waitUntil ?? 'commit',
        });
      }
      return nativeWaitForURL(url, options);
    };

    (page as any).goto = async (url: string, options?: any) => {
      if (
        (page as any)._musicscaleClientNavigationReady === true &&
        typeof url === 'string' &&
        url.startsWith('/')
      ) {
        const currentUrl = page.url();
        if (/^https?:\/\//i.test(currentUrl)) {
          const current = new URL(currentUrl);
          const target = new URL(url, current.origin);

          if (target.origin === current.origin && target.pathname !== '/login') {
            const nextHref = `${target.pathname}${target.search}${target.hash}`;

            await page.evaluate((href) => {
              const currentState = window.history.state || {};
              const currentIndex = typeof currentState.idx === 'number' ? currentState.idx : 0;

              window.history.pushState(
                {
                  ...currentState,
                  idx: currentIndex + 1,
                  key: `e2e-${Date.now()}`,
                },
                '',
                href,
              );
              window.dispatchEvent(
                new PopStateEvent('popstate', { state: window.history.state }),
              );
            }, nextHref);

            await nativeWaitForURL(
              (candidate) =>
                candidate.pathname === target.pathname &&
                (!target.search || candidate.search === target.search) &&
                (!target.hash || candidate.hash === target.hash),
              { timeout: options?.timeout ?? 10000, waitUntil: 'commit' },
            );

            // URL mutation is synchronous, while BrowserRouter commits the new
            // route on the following React/browser turns. Give it two frames so
            // sequential SPA gotos cannot collapse /scales -> /scales/:id into
            // an apparent same-param transition before route effects reset.
            await page.evaluate(() => new Promise<void>((resolve) => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            }));

            return null;
          }
        }
      }

      return nativeGoto(url, options);
    };
    
    page.on('pageerror', err => {
      errors.push(`PageError: ${err.message}`);
    });
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        const locationUrl = msg.location().url || '';
        const isExpectedFinOpsPreflightDenial =
          locationUrl.includes('/api/admin/finops-diagnostics/preflight') &&
          /401|Unauthorized/i.test(text);
        const ignoredPatterns = (page as any)._ignoredPatterns as RegExp[];
        const ignored = isExpectedFinOpsPreflightDenial || (ignoredPatterns && ignoredPatterns.some(p => p.test(text)));
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
