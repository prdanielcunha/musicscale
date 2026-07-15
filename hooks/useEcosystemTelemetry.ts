import { drainStartupTelemetry, subscribeStartupTelemetry, unsubscribeStartupTelemetry, StartupEvent } from '../lib/startupTelemetry';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useEcosystem } from '../contexts/EcosystemContext';

export function useEcosystemTelemetry() {
  const location = useLocation();
  const { publishEvent, isInitialized } = useEcosystem();

  const clickLogs = useRef<number[]>([]);

  useEffect(() => {
    if (isInitialized) {
      publishEvent({
        type: 'navigation',
        payload: { path: location.pathname, search: location.search },
        timestamp: Date.now()
      });
    }
  }, [location, isInitialized, publishEvent]);

  // Startup Telemetry sync
  const drainedRef = useRef(false);
  useEffect(() => {
    if (!isInitialized) return;

    const publishStartupEvent = (ev: StartupEvent) => {
        publishEvent({
            type: 'telemetry' as any, // bypassing strict types if necessary
            payload: {
                category: 'startup_performance',
                ...ev
            },
            timestamp: ev.timestamp
        });
    };

    if (!drainedRef.current) {
        drainedRef.current = true;
        const buffered = drainStartupTelemetry();
        buffered.forEach(publishStartupEvent);
    }

    const listener = (e: CustomEvent<StartupEvent>) => {
        publishStartupEvent(e.detail);
    };

    subscribeStartupTelemetry(listener);
    return () => {
        unsubscribeStartupTelemetry(listener);
    };
  }, [isInitialized, publishEvent]);

  // Rage click detection
  useEffect(() => {
    if (!isInitialized) return;

    const handlePointerDown = (e: PointerEvent) => {
      const now = Date.now();
      clickLogs.current.push(now);
      
      // Keep only clicks within the last 2 seconds
      clickLogs.current = clickLogs.current.filter(t => now - t < 2000);

      // If more than 4 clicks in 2 seconds, it's a rage click
      if (clickLogs.current.length >= 4) {
         publishEvent({
           type: 'ux_issue',
           payload: { issue: 'rage_click', path: window.location.pathname, target: (e.target as HTMLElement)?.tagName },
           timestamp: now
         });
         clickLogs.current = []; // Reset to prevent flooding
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isInitialized, publishEvent]);
}
