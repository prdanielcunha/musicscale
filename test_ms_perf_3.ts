import { 
  markStartupMetric, 
  incrementStartupCounter, 
  markStartupFailure, 
  recordStartupGauge,
  drainStartupTelemetry, 
  subscribeStartupTelemetry, 
  unsubscribeStartupTelemetry, 
  _resetStartupTelemetry,
  getStartupTelemetrySnapshot
} from './lib/startupTelemetry';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(msg);
    process.exit(1);
  }
}

function runTests() {
  console.log("Running MS-PERF-3 tests...");

  // 1 & 2: milestone registered only once & StrictMode no duplication
  _resetStartupTelemetry();
  markStartupMetric('test_milestone', { entry_mode: 'direct' });
  markStartupMetric('test_milestone', { entry_mode: 'handoff' });
  let events = getStartupTelemetrySnapshot();
  assert(events.length === 1, "Milestone should be registered only once");
  assert((events[0].attributes as any)?.entry_mode === 'direct', "First milestone attributes should be kept");

  // 3: counter can increment
  _resetStartupTelemetry();
  incrementStartupCounter('test_counter');
  incrementStartupCounter('test_counter');
  events = getStartupTelemetrySnapshot();
  assert(events.length === 2, "Counter should increment twice");

  // 4: buffer never exceeds 40 events
  _resetStartupTelemetry();
  for (let i = 0; i < 50; i++) {
    incrementStartupCounter('spam_counter');
  }
  events = getStartupTelemetrySnapshot();
  assert(events.length === 40, "Buffer should not exceed 40 events");

  // 5: drain returns events and clears buffer, but snapshot remains intact
  _resetStartupTelemetry();
  incrementStartupCounter('test_drain');
  const drained = drainStartupTelemetry();
  assert(drained.length === 1, "Drain should return 1 event");
  assert(getStartupTelemetrySnapshot().length === 1, "Snapshot should be intact after drain");
  const drainedAgain = drainStartupTelemetry();
  assert(drainedAgain.length === 0, "Buffer should be empty on second drain");
  assert(getStartupTelemetrySnapshot().length === 1, "Snapshot should still be intact after second drain");

  // 6 & 7: subscribe/unsubscribe
  _resetStartupTelemetry();
  let received = 0;
  let activeListeners: any[] = [];
  const listener = () => { received++; };
  // Mock window for CustomEvent if not in browser
  if (typeof window === 'undefined') {
     (global as any).window = {
        addEventListener: (name: string, fn: any) => { activeListeners.push(fn); },
        removeEventListener: (name: string, fn: any) => { activeListeners = activeListeners.filter(l => l !== fn); },
        dispatchEvent: (ev: any) => { activeListeners.forEach(fn => fn(ev)); }
     };
  }
  subscribeStartupTelemetry(listener as any);
  incrementStartupCounter('test_sub');
  assert(received === 1, "Listener should receive event");
  unsubscribeStartupTelemetry(listener as any);
  incrementStartupCounter('test_sub_2');
  assert(received === 1, "Listener should not receive event after unsubscribe");
  
  if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
      delete (global as any).window; // cleanup mock
  }

  // 8, 9, 10, 11: attributes not permitted are removed
  _resetStartupTelemetry();
  markStartupMetric('test_attrs', { 
    token: 'secret', 
    email: 'test@example.com', 
    uid: '123', 
    organizationId: 'org123',
    entry_mode: 'direct',
    standalone: true
  });
  events = getStartupTelemetrySnapshot();
  assert((events[0].attributes as any)?.token === undefined, "token should be removed");
  assert((events[0].attributes as any)?.email === undefined, "email should be removed");
  assert((events[0].attributes as any)?.uid === undefined, "uid should be removed");
  assert((events[0].attributes as any)?.organizationId === undefined, "organizationId should be removed");
  assert((events[0].attributes as any)?.entry_mode === 'direct', "entry_mode should be kept");
  assert((events[0].attributes as any)?.standalone === true, "standalone should be kept");

  // 12: raw error message not accepted
  _resetStartupTelemetry();
  markStartupFailure('some raw error message');
  events = getStartupTelemetrySnapshot();
  assert(events.length === 0, "markStartupFailure with unknown code should not create event");

  // 13: negative cache_age_ms normalized
  _resetStartupTelemetry();
  recordStartupGauge('test_cache_age', -500, { cache_age_ms: -500 });
  events = getStartupTelemetrySnapshot();
  assert((events[0].attributes as any)?.cache_age_ms === undefined, "negative cache_age_ms should be removed/undefined");

  // 14 & 15: no window/sessionStorage handles gracefully
  // tested by running this file in node

  // 16: startup_failure_reason only enumerations
  _resetStartupTelemetry();
  markStartupFailure('chunk_load_failure');
  events = getStartupTelemetrySnapshot();
  assert((events[0].attributes as any)?.failure_reason === 'chunk_load_failure', "enumerated failure should be kept");

  // 17: snapshot no sensitive data
  // verified by 8-11.

  // MS-PERF-3-FIX-1 new tests
  _resetStartupTelemetry();
  recordStartupGauge('test_gauge', 42);
  events = getStartupTelemetrySnapshot();
  assert(events[0].kind === 'gauge', "gauge should have kind gauge");
  assert(events[0].value === 42, "gauge should preserve numerical value");

  _resetStartupTelemetry();
  recordStartupGauge('test_gauge_dup', 10);
  recordStartupGauge('test_gauge_dup', 20);
  events = getStartupTelemetrySnapshot();
  assert(events.length === 1, "gauge of the same name should not duplicate");
  assert(events[0].value === 10, "gauge should keep first value");

  _resetStartupTelemetry();
  recordStartupGauge('test_gauge_dup', 30);
  events = getStartupTelemetrySnapshot();
  assert(events.length === 1, "reset allows recording gauge again");
  assert(events[0].value === 30, "reset allows new value");

  _resetStartupTelemetry();
  recordStartupGauge('cache_hit', 1, { cache_hit: 'true' as any }); // string instead of boolean
  events = getStartupTelemetrySnapshot();
  assert((events[0].attributes as any)?.cache_hit === undefined, "cache_hit accepts only boolean");

  _resetStartupTelemetry();
  recordStartupGauge('cache_hit2', 1, { cache_status: 'foo' as any });
  events = getStartupTelemetrySnapshot();
  assert((events[0].attributes as any)?.cache_status === undefined, "invalid cache_status is removed");

  _resetStartupTelemetry();
  markStartupMetric('test_entry_mode', { entry_mode: 'invalid' as any });
  events = getStartupTelemetrySnapshot();
  assert((events[0].attributes as any)?.entry_mode === undefined, "invalid entry_mode is removed");

  _resetStartupTelemetry();
  markStartupMetric('test_standalone', { standalone: 1 as any });
  events = getStartupTelemetrySnapshot();
  assert((events[0].attributes as any)?.standalone === undefined, "invalid standalone is removed");

  _resetStartupTelemetry();
  recordStartupGauge('test_cache_age2', 500, { cache_age_ms: NaN });
  events = getStartupTelemetrySnapshot();
  assert((events[0].attributes as any)?.cache_age_ms === undefined, "NaN cache_age_ms is refused");

  console.log("All MS-PERF-3 tests passed.");
}

runTests();
