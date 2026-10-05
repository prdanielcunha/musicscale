
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { version as APP_BUILD_VERSION } from './package.json';

import { AppErrorBoundary } from './components/AppErrorBoundary';
import { markStartupMetric, incrementStartupCounter, markStartupFailure } from './lib/startupTelemetry';
import './performance-v2.css';
import './operational-v2.css';
import './premium-v2-completion.css';
import './ai-import-fidelity.css';


const urlParams = new URLSearchParams(window.location.search);
const entryMode = urlParams.has('ecosystem_ctx') ? 'handoff' : 'direct';
markStartupMetric('app_started_ms', { entry_mode: entryMode });

// Prevent infinite reload loop
// Prevent infinite reload loop

function safeSessionStorageGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionStorageSet(key: string, value: string): boolean {
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

const RELOAD_FLAG = 'musicscale_chunk_reloaded';


const handleChunkError = (event: Event | PromiseRejectionEvent, message?: string) => {
    const errorMessage = message || (event as PromiseRejectionEvent).reason?.message || '';
  if (
    errorMessage.includes('Failed to fetch dynamically imported module') ||
    errorMessage.includes('ChunkLoadError') ||
    errorMessage.includes('Importing a module script failed')
  ) {
    event.preventDefault();
    const lastReload = safeSessionStorageGet(RELOAD_FLAG);
    const now = Date.now();
    // Only reload if the last reload was more than 10 seconds ago
    if (!lastReload || now - parseInt(lastReload) > 10000) {
      const saved = safeSessionStorageSet(RELOAD_FLAG, now.toString());
      if (saved) {
        incrementStartupCounter('retry_count');
        console.warn('Chunk load failed, forcing reload once for new version...');
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('v', now.toString());
        markStartupFailure('chunk_load_failure');
        incrementStartupCounter('redirect_count');
        window.location.href = newUrl.toString();
      }
    } else {
      console.error('Chunk load failed twice, showing error screen.');
      // The ErrorBoundary will catch the suspended module failure
    }
  }
};

window.addEventListener('unhandledrejection', handleChunkError);
window.addEventListener('vite:preloadError', handleChunkError);

const VERSION_CHECK_INTERVAL_MS = 30 * 1000;
const VERSION_MANIFEST_PATH = '/version.json';
const UPDATE_BANNER_ID = 'musicscale-update-available';
const SERVICE_WORKER_OPERATION_TIMEOUT_MS = 1200;
const UPDATE_CLICK_FALLBACK_MS = 3200;

let latestPublishedVersion: string | null = null;
let updateNavigationStarted = false;

function isVersionManifest(payload: unknown): payload is { version: string } {
  if (!payload || typeof payload !== 'object') return false;
  const version = (payload as { version?: unknown }).version;
  return typeof version === 'string' && version.length > 0;
}

function withOperationTimeout<T>(promise: Promise<T>, timeoutMs = SERVICE_WORKER_OPERATION_TIMEOUT_MS): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, timeoutMs);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(null);
      }
    );
  });
}

async function getServiceWorkerRegistrationWithTimeout(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return withOperationTimeout(navigator.serviceWorker.getRegistration());
}

async function refreshServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  const registration = await getServiceWorkerRegistrationWithTimeout();
  if (!registration) return null;

  const updated = await withOperationTimeout(registration.update());
  if (updated === null) {
    console.warn('[MusicScale] Service worker update check timed out or failed');
  }

  return registration;
}

function navigateToLatestVersion() {
  if (updateNavigationStarted) return;
  updateNavigationStarted = true;

  const refreshUrl = new URL(window.location.href);
  refreshUrl.searchParams.set('v', latestPublishedVersion ?? Date.now().toString());
  window.location.replace(refreshUrl.toString());
}

async function reloadIntoLatestVersion(button: HTMLButtonElement) {
  button.disabled = true;
  button.textContent = 'Atualizando...';

  // Never let WebKit keep the UI trapped in "Atualizando...". Even if every
  // Service Worker promise stalls, force a cache-busted navigation.
  const fallbackTimer = window.setTimeout(navigateToLatestVersion, UPDATE_CLICK_FALLBACK_MS);

  try {
    const registration = await getServiceWorkerRegistrationWithTimeout();

    if (registration) {
      // The new build is already confirmed by /version.json. Unregistering the
      // current worker before navigation is more deterministic on iOS than
      // waiting indefinitely for registration.update()/controllerchange.
      const unregistered = await withOperationTimeout(registration.unregister());
      if (unregistered === null) {
        console.warn('[MusicScale] Service worker unregister timed out; forcing navigation fallback');
      }
    }
  } catch (error) {
    console.warn('[MusicScale] Update handoff failed; forcing navigation fallback', error);
  } finally {
    window.clearTimeout(fallbackTimer);
    navigateToLatestVersion();
  }
}

function showUpdateAvailableBanner(publishedVersion?: string) {
  if (publishedVersion) latestPublishedVersion = publishedVersion;
  if (document.getElementById(UPDATE_BANNER_ID)) return;

  const button = document.createElement('button');
  button.id = UPDATE_BANNER_ID;
  button.type = 'button';
  button.setAttribute('aria-label', 'Atualizar MusicScale para a versão mais recente');
  button.textContent = 'Nova versão do MusicScale disponível — Atualizar agora';
  button.style.position = 'fixed';
  button.style.left = '50%';
  button.style.bottom = 'max(18px, env(safe-area-inset-bottom))';
  button.style.transform = 'translateX(-50%)';
  button.style.zIndex = '2147483647';
  button.style.maxWidth = 'calc(100vw - 32px)';
  button.style.padding = '12px 18px';
  button.style.border = '1px solid rgba(255,255,255,0.14)';
  button.style.borderRadius = '14px';
  button.style.background = 'rgba(15, 23, 42, 0.96)';
  button.style.color = '#fff';
  button.style.font = '600 14px/1.25 Inter, system-ui, sans-serif';
  button.style.boxShadow = '0 16px 48px rgba(0,0,0,0.38)';
  button.style.backdropFilter = 'blur(16px)';
  button.style.cursor = 'pointer';

  button.addEventListener('click', () => {
    void reloadIntoLatestVersion(button);
  });

  document.body.appendChild(button);
}

async function checkPublishedVersion() {
  if (document.visibilityState !== 'visible' || !navigator.onLine) return;

  try {
    const manifestUrl = new URL(VERSION_MANIFEST_PATH, window.location.origin);
    manifestUrl.searchParams.set('t', Date.now().toString());

    const response = await fetch(manifestUrl.toString(), {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!response.ok) return;
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return;

    const manifest: unknown = await response.json();
    if (!isVersionManifest(manifest)) return;

    if (manifest.version !== APP_BUILD_VERSION) {
      showUpdateAvailableBanner(manifest.version);
      void refreshServiceWorker();
    }
  } catch (error) {
    console.warn('[MusicScale] Published version check failed', error);
  }
}

function installReleaseFreshnessGuard() {
  let hasActiveController = 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasActiveController) {
        showUpdateAvailableBanner();
      }
      hasActiveController = true;
    });
  }

  window.addEventListener('load', () => {
    let intervalId: number | null = null;

    const stopPeriodicChecks = () => {
      if (intervalId === null) return;
      window.clearInterval(intervalId);
      intervalId = null;
    };

    const checkForUpdate = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      void checkPublishedVersion();
      void refreshServiceWorker();
    };

    const startPeriodicChecks = () => {
      stopPeriodicChecks();
      if (document.visibilityState !== 'visible') return;
      intervalId = window.setInterval(checkForUpdate, VERSION_CHECK_INTERVAL_MS);
    };

    const checkImmediately = () => {
      checkForUpdate();
      startPeriodicChecks();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkImmediately();
      } else {
        stopPeriodicChecks();
      }
    };

    checkImmediately();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkImmediately);
    window.addEventListener('online', checkImmediately);
  });
}

installReleaseFreshnessGuard();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}


const BOOT_IMPORT_TIMEOUT_MS = 12000;

function withBootTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorCode: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(errorCode));
    }, timeoutMs);

    promise.then(
      value => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      error => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

const LazyApp = lazy(async () => {
  const [, appModule] = await Promise.all([
    withBootTimeout(
      import('./lib/i18n'),
      BOOT_IMPORT_TIMEOUT_MS,
      'I18N_BOOT_TIMEOUT'
    ),
    withBootTimeout(
      import('./App'),
      BOOT_IMPORT_TIMEOUT_MS,
      'APP_BOOT_TIMEOUT'
    )
  ]);

  return appModule;
});

function swallowStartupInteraction(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
  const nativeEvent = event.nativeEvent as Event;
  nativeEvent.stopImmediatePropagation?.();
}
  

const fallbackLoader = (
  <div
    style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#050505', color: 'white', position: 'relative', overflow: 'hidden', touchAction: 'none' }}
    onPointerDown={swallowStartupInteraction}
    onPointerUp={swallowStartupInteraction}
    onPointerCancel={swallowStartupInteraction}
    onTouchStart={swallowStartupInteraction}
    onTouchMove={swallowStartupInteraction}
    onTouchEnd={swallowStartupInteraction}
    onTouchCancel={swallowStartupInteraction}
    onClick={swallowStartupInteraction}
    onContextMenu={swallowStartupInteraction}
  >
    <div style={{ position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none' }}>
       <svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg' style={{ width: '100%', height: '100%' }}><filter id='noiseFilter'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#noiseFilter)'/></svg>
    </div>
    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '250px', height: '250px', background: 'rgba(99, 102, 241, 0.1)', filter: 'blur(100px)', borderRadius: '50%' }}></div>
    <svg className="animate-spin" style={{ width: '40px', height: '40px', color: '#6366f1' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  </div>
);

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <Suspense fallback={fallbackLoader}>
        <LazyApp />
      </Suspense>
    </AppErrorBoundary>
  </React.StrictMode>
);
