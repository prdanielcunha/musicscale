import {
  getStartupTelemetrySnapshot,
  subscribeStartupTelemetry,
  unsubscribeStartupTelemetry,
} from './startupTelemetry';

const FIRST_OPERATIONAL_METRIC = 'first_operational_screen_ms';
const DEFAULT_FALLBACK_MS = 2500;
const DEFAULT_IDLE_TIMEOUT_MS = 900;

let quietWindowPromise: Promise<void> | null = null;
let quietWindowCompleted = false;

function isSyntheticBrowserRuntime(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /\bjsdom\b/i.test(navigator.userAgent || '');
}

function isColdMobileStartup(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const compactViewport = typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 1024px)').matches
    : window.innerWidth <= 1024;
  const coarsePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : navigator.maxTouchPoints > 0;

  return compactViewport && coarsePointer;
}

function afterPaintAndIdle(idleTimeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const afterFrames = () => {
      const requestIdle = (window as Window & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      }).requestIdleCallback;

      if (typeof requestIdle === 'function') {
        requestIdle(() => resolve(), { timeout: idleTimeoutMs });
        return;
      }

      window.setTimeout(resolve, 32);
    };

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(afterFrames);
    });
  });
}

function waitForFirstOperationalMetric(fallbackMs: number): Promise<void> {
  if (getStartupTelemetrySnapshot().some((event) => event.metric === FIRST_OPERATIONAL_METRIC)) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let settled = false;
    let timeoutId = 0;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      unsubscribeStartupTelemetry(onMetric);
      resolve();
    };

    const onMetric = (event: CustomEvent) => {
      if (event.detail?.metric === FIRST_OPERATIONAL_METRIC) {
        finish();
      }
    };

    subscribeStartupTelemetry(onMetric);
    timeoutId = window.setTimeout(finish, fallbackMs);

    if (getStartupTelemetrySnapshot().some((event) => event.metric === FIRST_OPERATIONAL_METRIC)) {
      finish();
    }
  });
}

/**
 * Keeps non-essential bootstrap work away from the first interactive mobile
 * frames. The wait is coalesced and runs at most once per loaded app session;
 * after the startup quiet window completes, later repository calls are not
 * delayed at all.
 *
 * Synthetic browser runtimes such as jsdom intentionally fail open. They do
 * not have a real paint/idle pipeline, so accumulating timers or idle waits in
 * tests would only add artificial work without validating the production UX.
 *
 * This is deliberately fail-open: if the operational milestone never arrives,
 * background work resumes after a short bounded fallback instead of hanging.
 */
export async function waitForStartupQuietWindow(options?: {
  fallbackMs?: number;
  idleTimeoutMs?: number;
}): Promise<void> {
  if (
    typeof window === 'undefined' ||
    isSyntheticBrowserRuntime() ||
    !isColdMobileStartup() ||
    quietWindowCompleted
  ) return;

  if (!quietWindowPromise) {
    const fallbackMs = options?.fallbackMs ?? DEFAULT_FALLBACK_MS;
    const idleTimeoutMs = options?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;

    quietWindowPromise = (async () => {
      await waitForFirstOperationalMetric(fallbackMs);
      await afterPaintAndIdle(idleTimeoutMs);
    })().finally(() => {
      quietWindowCompleted = true;
      quietWindowPromise = null;
    });
  }

  await quietWindowPromise;
}
