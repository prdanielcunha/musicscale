export type InteractionMetricName =
  | 'mobile_drawer_open_to_paint_ms'
  | 'mobile_drawer_close_to_paint_ms'
  | 'welcome_open_to_paint_ms'
  | 'welcome_close_to_paint_ms';

export interface InteractionTelemetryEvent {
  metric: InteractionMetricName;
  value: number;
  timestamp: number;
}

const MAX_SNAPSHOT_EVENTS = 20;
const eventName = 'musicscale:interaction-telemetry';
const storageKey = 'musicscale:interaction-snapshot';

const now = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

const emit = (event: InteractionTelemetryEvent) => {
  if (typeof window === 'undefined') return;

  try {
    const existing = JSON.parse(window.sessionStorage.getItem(storageKey) || '[]');
    const snapshot = Array.isArray(existing) ? existing : [];
    snapshot.push(event);
    window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot.slice(-MAX_SNAPSHOT_EVENTS)));
  } catch {
    // Telemetry must never interfere with the interaction it measures.
  }

  try {
    window.dispatchEvent(new CustomEvent<InteractionTelemetryEvent>(eventName, { detail: event }));
  } catch {
    // Telemetry is best effort only.
  }
};

/**
 * Start measuring an interaction at input time. Call the returned function
 * immediately after scheduling the React state change. The metric is emitted
 * after two animation frames so it approximates input-to-visible-paint rather
 * than just JavaScript handler duration.
 */
export const beginInteractionPaintMeasurement = (metric: InteractionMetricName) => {
  const startedAt = now();
  let finished = false;

  return () => {
    if (finished) return;
    finished = true;

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      emit({ metric, value: Math.max(0, now() - startedAt), timestamp: Date.now() });
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        emit({ metric, value: Math.max(0, now() - startedAt), timestamp: Date.now() });
      });
    });
  };
};

export const subscribeInteractionTelemetry = (
  listener: (event: CustomEvent<InteractionTelemetryEvent>) => void,
) => {
  if (typeof window !== 'undefined') {
    window.addEventListener(eventName, listener as EventListener);
  }
};

export const unsubscribeInteractionTelemetry = (
  listener: (event: CustomEvent<InteractionTelemetryEvent>) => void,
) => {
  if (typeof window !== 'undefined') {
    window.removeEventListener(eventName, listener as EventListener);
  }
};
