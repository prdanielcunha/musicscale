import {
  getStartupTelemetrySnapshot,
  subscribeStartupTelemetry,
  unsubscribeStartupTelemetry,
} from './startupTelemetry';

const FIRST_OPERATIONAL_METRIC = 'first_operational_screen_ms';
const DEFAULT_FALLBACK_MS = 2500;
const DEFAULT_IDLE_TIMEOUT_MS = 900;

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

/**
 * Keeps non-essential bootstrap work away from the first interactive mobile
 * frames. Desktop and already-warm sessions are not delayed.
 *
 * This is deliberately fail-open: if the operational milestone never arrives,
 * background work resumes after a short bounded fallback instead of hanging.
 */
export async function waitForStartupQuietWindow(options?: {
  fallbackMs?: number;
  idleTimeoutMs?: number;
}): Promise<void> {
  if (typeof window === 'undefined' || !isColdMobileStartup()) return;

  const fallbackMs = options?.fallbackMs ?? DEFAULT_FALLBACK_MS;
  const idleTimeoutMs = options?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;

  if (getStartupTelemetrySnapshot().some((event) => event.metric === FIRST_OPERATIONAL_METRIC)) {
    await afterPaintAndIdle(idleTimeoutMs);
    return;
  }

  await new Promise<void>((resolve) => {
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

  await afterPaintAndIdle(idleTimeoutMs);
}
