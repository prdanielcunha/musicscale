import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getStartupTelemetrySnapshot, subscribeStartupTelemetry, unsubscribeStartupTelemetry } from '../../lib/startupTelemetry';

let registrationStarted = false;
const READY_EVENT = 'musicscale:startup-interactive-ready';

/** Keep the complete offline precache, but let critical downloads finish first. */
export default function DeferredPwaRegistration() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator) || registrationStarted) return;
    let timer: number | undefined;
    let ready = pathname === '/login';

    const schedule = () => {
      if (!ready || timer !== undefined || registrationStarted || navigator.onLine === false || document.visibilityState === 'hidden') return;
      timer = window.setTimeout(() => {
        timer = undefined;
        if (navigator.onLine === false || document.visibilityState === 'hidden' || registrationStarted) return;
        registrationStarted = true;
        // Native registration preserves the existing update/version-banner
        // behavior: no Workbox-window reload can interrupt an unsaved form.
        void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
          registrationStarted = false;
        });
      }, 3000);
    };
    const onReady = () => { ready = true; schedule(); };
    const onMetric = (event: CustomEvent) => {
      if (event.detail?.metric === 'first_operational_screen_ms') onReady();
    };

    subscribeStartupTelemetry(onMetric);
    window.addEventListener(READY_EVENT, onReady);
    window.addEventListener('online', schedule);
    document.addEventListener('visibilitychange', schedule);
    if (getStartupTelemetrySnapshot().some(event => event.metric === 'first_operational_screen_ms')) ready = true;
    schedule();

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      unsubscribeStartupTelemetry(onMetric);
      window.removeEventListener(READY_EVENT, onReady);
      window.removeEventListener('online', schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [pathname]);

  return null;
}
