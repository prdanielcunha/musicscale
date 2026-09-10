import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('mobile cold-start P3 contract', () => {
  it('keeps nonessential welcome code off the critical private-app request path', () => {
    const app = read('App.tsx');

    expect(app).not.toContain('preloadFirstAccessWelcome');
    expect(app).not.toContain("import('./components/WhatsNewModal')");
    expect(app).toContain('<StartupInteractionBoundary>');
    expect(app).toContain('<PrivateApp />');
  });

  it('provides a bounded mobile startup quiet window after the first operational paint', () => {
    const scheduler = read('lib/startupWorkScheduler.ts');

    expect(scheduler).toContain("FIRST_OPERATIONAL_METRIC = 'first_operational_screen_ms'");
    expect(scheduler).toContain("window.matchMedia('(pointer: coarse)').matches");
    expect(scheduler).toContain('requestAnimationFrame');
    expect(scheduler).toContain('requestIdleCallback');
    expect(scheduler).toContain('DEFAULT_FALLBACK_MS = 2500');
    expect(scheduler).toContain('unsubscribeStartupTelemetry(onMetric)');
  });

  it('fails open in synthetic jsdom runtimes so test workers do not accumulate fake paint timers', () => {
    const scheduler = read('lib/startupWorkScheduler.ts');

    expect(scheduler).toContain('isSyntheticBrowserRuntime()');
    expect(scheduler).toContain('/\\bjsdom\\b/i.test(navigator.userAgent');
    expect(scheduler.indexOf('isSyntheticBrowserRuntime()')).toBeLessThan(
      scheduler.indexOf('!isColdMobileStartup()')
    );
  });

  it('defers secondary repositories and cached critical revalidation only when safe', () => {
    const api = read('contexts/ApiContext.tsx');

    expect(api).toContain('repository.eventNames');
    expect(api).toContain('repository.tags');
    expect(api).toContain('repository.roles');
    expect(api).toContain('repository.instruments');
    expect(api).toContain('repository.users');
    expect(api).toContain('repository.fixedBandScales');
    expect(api).toContain("cache.status === 'fresh' || cache.status === 'stale'");
    expect(api).toContain('if (canPaintFromCache)');
    expect(api).toContain('repository.songs');
    expect(api).toContain('repository.scales');
    expect(api).toContain('repository.bandScales');
    expect(api).toContain('repository.eventTypes');
    expect(api).toContain('repository.locations');
    expect(api).toContain('waitForStartupQuietWindow()');
  });

  it('moves hidden and realtime secondary work away from the first interaction frames', () => {
    const suggestions = read('hooks/useSuggestions.ts');
    const finops = read('hooks/useFinOpsDiagnosticsAccess.ts');
    const notifications = read('contexts/NotificationContext.tsx');

    expect(suggestions).toContain('waitForStartupQuietWindow()');
    expect(suggestions.indexOf('waitForStartupQuietWindow()')).toBeLessThan(
      suggestions.indexOf('suggestionApi.onSuggestionsUpdate')
    );

    expect(finops).toContain('waitForStartupQuietWindow()');
    expect(finops.indexOf('await waitForStartupQuietWindow()')).toBeLessThan(
      finops.indexOf("fetch('/api/admin/finops-diagnostics/preflight'")
    );

    expect(notifications).toContain('waitForStartupQuietWindow()');
    expect(notifications.indexOf('waitForStartupQuietWindow()')).toBeLessThan(
      notifications.indexOf('onSnapshot(q')
    );
  });
});
