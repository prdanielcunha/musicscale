export type MetricKind = 'milestone' | 'counter' | 'gauge' | 'failure';

export type AllowedAttributes = {
  entry_mode?: 'direct' | 'handoff';
  cache_status?: 'fresh' | 'stale' | 'miss' | 'invalid';
  cache_hit?: boolean;
  cache_age_ms?: number;
  failure_reason?: string;
  standalone?: boolean;
};

export type StartupEvent = {
  metric: string;
  value: number;
  kind: MetricKind;
  timestamp: number;
  attributes?: AllowedAttributes;
};

const ALLOWED_ATTRIBUTE_KEYS = new Set([
  'entry_mode',
  'cache_status',
  'cache_hit',
  'cache_age_ms',
  'failure_reason',
  'standalone'
]);

const ALLOWED_FAILURE_REASONS = new Set([
  'chunk_load_failure',
  'handoff_expired',
  'handoff_invalid',
  'handoff_unavailable',
  'critical_data_failed',
  'critical_data_timeout',
  'secondary_data_failed',
  'cache_invalid'
]);

const MAX_EVENTS = 40;
let eventBuffer: StartupEvent[] = [];
let snapshotBuffer: StartupEvent[] = [];
const recordedMilestones = new Set<string>();
const recordedGauges = new Set<string>();

// Initial time reference for fallback
const fallbackStartTime = Date.now();

function getNowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now() - fallbackStartTime;
}

function sanitizeAttributes(attrs?: any): AllowedAttributes | undefined {
  if (!attrs) return undefined;
  const sanitized: any = {};
  for (const key of Object.keys(attrs)) {
    if (ALLOWED_ATTRIBUTE_KEYS.has(key)) {
      if (key === 'cache_age_ms') {
        const age = Number(attrs[key]);
        if (Number.isFinite(age) && age >= 0) {
            sanitized[key] = age;
        }
      } else if (key === 'failure_reason') {
         if (ALLOWED_FAILURE_REASONS.has(attrs[key])) {
            sanitized[key] = attrs[key];
         }
      } else if (key === 'entry_mode') {
         if (attrs[key] === 'direct' || attrs[key] === 'handoff') {
             sanitized[key] = attrs[key];
         }
      } else if (key === 'cache_status') {
         if (['fresh', 'stale', 'miss', 'invalid'].includes(attrs[key])) {
             sanitized[key] = attrs[key];
         }
      } else if (key === 'cache_hit') {
         if (typeof attrs[key] === 'boolean') {
             sanitized[key] = attrs[key];
         }
      } else if (key === 'standalone') {
         if (typeof attrs[key] === 'boolean') {
             sanitized[key] = attrs[key];
         }
      }
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function addEvent(event: StartupEvent) {
  if (snapshotBuffer.length >= MAX_EVENTS) return;
  
  eventBuffer.push(event);
  snapshotBuffer.push(event);

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('musicscale:startup-snapshot', JSON.stringify(snapshotBuffer));
    } catch (e) {
      // ignore sessionStorage errors
    }

    try {
      const customEvent = new CustomEvent('musicscale:startup-telemetry', { detail: event });
      window.dispatchEvent(customEvent);
    } catch (e) {
      // ignore dispatch errors
    }
  }
}

export function markStartupMetric(name: string, attributes?: any) {
  if (recordedMilestones.has(name)) return;
  recordedMilestones.add(name);

  addEvent({
    metric: name,
    value: getNowMs(),
    kind: 'milestone',
    timestamp: Date.now(),
    attributes: sanitizeAttributes(attributes)
  });
}

export function incrementStartupCounter(name: string, attributes?: any) {
  addEvent({
    metric: name,
    value: 1,
    kind: 'counter',
    timestamp: Date.now(),
    attributes: sanitizeAttributes(attributes)
  });
}

export function recordStartupGauge(name: string, value: number, attributes?: any) {
  if (recordedGauges.has(name)) return;
  if (!Number.isFinite(value)) return;
  recordedGauges.add(name);

  addEvent({
    metric: name,
    value: value,
    kind: 'gauge',
    timestamp: Date.now(),
    attributes: sanitizeAttributes(attributes)
  });
}

export function markStartupFailure(reason: string, attributes?: any) {
  if (!ALLOWED_FAILURE_REASONS.has(reason)) return;
  addEvent({
    metric: 'startup_failure_reason',
    value: getNowMs(),
    kind: 'failure',
    timestamp: Date.now(),
    attributes: sanitizeAttributes({ ...attributes, failure_reason: reason })
  });
}

export function subscribeStartupTelemetry(listener: (event: CustomEvent<StartupEvent>) => void) {
  if (typeof window !== 'undefined') {
    window.addEventListener('musicscale:startup-telemetry', listener as EventListener);
  }
}

export function unsubscribeStartupTelemetry(listener: (event: CustomEvent<StartupEvent>) => void) {
  if (typeof window !== 'undefined') {
    window.removeEventListener('musicscale:startup-telemetry', listener as EventListener);
  }
}

export function getStartupTelemetrySnapshot(): StartupEvent[] {
  return [...snapshotBuffer];
}

export function drainStartupTelemetry(): StartupEvent[] {
  const current = [...eventBuffer];
  eventBuffer = [];
  return current;
}

// For tests
export function _resetStartupTelemetry() {
   eventBuffer = [];
   snapshotBuffer = [];
   recordedMilestones.clear();
   recordedGauges.clear();
   if (typeof window !== 'undefined') {
     try {
       sessionStorage.removeItem('musicscale:startup-snapshot');
     } catch (e) {
       // ignore
     }
   }
}
