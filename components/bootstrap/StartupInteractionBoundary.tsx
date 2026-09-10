import React, { Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Spinner from '../common/Spinner';
import {
  getStartupTelemetrySnapshot,
  markStartupMetric,
  subscribeStartupTelemetry,
  unsubscribeStartupTelemetry,
} from '../../lib/startupTelemetry';

const AUTH_PROFILE_READY_METRIC = 'auth_profile_completed_ms';
const START_GATEWAY_READY_EVENT = 'musicscale:startup-interactive-ready';
let mobileWarmupStarted = false;

function hasReturningOrganizationPreference(): boolean {
  try {
    const organizationId = window.localStorage.getItem('activeOrganizationId');
    return Boolean(organizationId && organizationId !== 'offline_default');
  } catch {
    return false;
  }
}

function shouldWarmCriticalApi(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (window.location.pathname === '/login' || navigator.onLine === false) return false;
  if (!hasReturningOrganizationPreference()) return false;

  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return false;

  const compactViewport = typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 1024px)').matches
    : window.innerWidth <= 1024;
  const coarsePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : navigator.maxTouchPoints > 0;

  return compactViewport && coarsePointer;
}

function warmCriticalApiOnce() {
  if (mobileWarmupStarted || !shouldWarmCriticalApi()) return;
  mobileWarmupStarted = true;
  markStartupMetric('critical_api_warmup_started_ms');

  // This deliberately carries no Bearer token. access-context rejects it with 401
  // before Firestore reads, but the request can wake a scale-to-zero Cloud Run
  // revision while the client is restoring Firebase Auth and the private bundle.
  void fetch('/api/v1/ecosystem/access-context?organizationId=__startup_warmup__', {
    method: 'HEAD',
    cache: 'no-store',
    credentials: 'same-origin',
  })
    .catch(() => undefined)
    .finally(() => markStartupMetric('critical_api_warmup_settled_ms'));
}

const StartupFallback = () => (
  <div
    className="flex h-[100dvh] w-[100dvw] items-center justify-center bg-[#050505]"
    aria-busy="true"
  >
    <Spinner size="lg" />
  </div>
);

function swallowStartupInteraction(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
  const nativeEvent = event.nativeEvent as Event;
  nativeEvent.stopImmediatePropagation?.();
}

/**
 * Keeps the private startup path fail-closed while making two mobile-specific
 * guarantees:
 * 1. returning touch devices can wake the scale-to-zero API in parallel;
 * 2. touches made against a loading surface are consumed and cannot be replayed
 *    against newly-mounted buttons after bootstrap completes.
 */
export const StartupInteractionBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [authProfileReady, setAuthProfileReady] = useState(() =>
    getStartupTelemetrySnapshot().some(event => event.metric === AUTH_PROFILE_READY_METRIC)
  );
  const [startGatewayReady, setStartGatewayReady] = useState(false);
  const [released, setReleased] = useState(false);

  useEffect(() => {
    warmCriticalApiOnce();
  }, []);

  useEffect(() => {
    const onStartupMetric = (event: CustomEvent) => {
      if (event.detail?.metric === AUTH_PROFILE_READY_METRIC) {
        setAuthProfileReady(true);
      }
    };
    const onStartGatewayReady = () => setStartGatewayReady(true);

    subscribeStartupTelemetry(onStartupMetric);
    window.addEventListener(START_GATEWAY_READY_EVENT, onStartGatewayReady);

    // Cover the tiny window between initial render and effect subscription.
    if (getStartupTelemetrySnapshot().some(event => event.metric === AUTH_PROFILE_READY_METRIC)) {
      setAuthProfileReady(true);
    }

    return () => {
      unsubscribeStartupTelemetry(onStartupMetric);
      window.removeEventListener(START_GATEWAY_READY_EVENT, onStartGatewayReady);
    };
  }, []);

  useEffect(() => {
    if (released || !authProfileReady) return;
    if (location.pathname === '/start' && !startGatewayReady) return;

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setReleased(true));
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [authProfileReady, location.pathname, released, startGatewayReady]);

  useEffect(() => {
    if (released) {
      markStartupMetric('first_interactive_ms');
    }
  }, [released]);

  return (
    <>
      <Suspense fallback={<StartupFallback />}>
        {children}
      </Suspense>

      {!released && (
        <div
          data-testid="startup-interaction-shield"
          aria-hidden="true"
          className="fixed inset-0 z-[2147483647] cursor-wait select-none touch-none"
          style={{ touchAction: 'none' }}
          onPointerDown={swallowStartupInteraction}
          onPointerUp={swallowStartupInteraction}
          onPointerCancel={swallowStartupInteraction}
          onTouchStart={swallowStartupInteraction}
          onTouchMove={swallowStartupInteraction}
          onTouchEnd={swallowStartupInteraction}
          onTouchCancel={swallowStartupInteraction}
          onClick={swallowStartupInteraction}
          onContextMenu={swallowStartupInteraction}
        />
      )}
    </>
  );
};

export default StartupInteractionBoundary;
