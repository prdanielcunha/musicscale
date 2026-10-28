
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { version as APP_BUILD_VERSION } from './package.json';

import BootLoadingScreen from './components/bootstrap/BootLoadingScreen';
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
const UPDATE_RECOVERY_TIMEOUT_MS = 1800;

let latestPublishedVersion: string | null = null;
let updateNavigationStarted = false;

function isVersionManifest(payload: unknown): payload is { version: string } {
  if (!payload || typeof payload !== 'object') return false;
  const version = (payload as { version?: unknown }).version;
  return typeof version === 'string' && version.length > 0;
}

function settleWithin(promise: Promise<unknown>, timeoutMs: number): Promise<void> {
  return Promise.race([
    promise.then(() => undefined).catch(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

async function releaseLegacyNavigationShell(): Promise<void> {
  const recoveryTasks: Promise<unknown>[] = [];

  if ('serviceWorker' in navigator) {
    recoveryTasks.push((async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((registration) => registration.unregister()));
    })());
  }

  if ('caches' in window) {
    recoveryTasks.push((async () => {
      const cacheNames = await window.caches.keys();
      const shellUrls = [
        new URL('/', window.location.origin).href,
        new URL('/index.html', window.location.origin).href,
      ];

      await Promise.all(cacheNames.map(async (cacheName) => {
        const cache = await window.caches.open(cacheName);
        await Promise.allSettled(
          shellUrls.map((url) => cache.delete(new Request(url), { ignoreSearch: true })),
        );
      }));
    })());
  }

  await settleWithin(Promise.allSettled(recoveryTasks), UPDATE_RECOVERY_TIMEOUT_MS);
}

async function navigateToLatestVersion() {
  if (updateNavigationStarted) return;
  updateNavigationStarted = true;

  // A legacy Workbox worker may still control an iPhone tab even after Hosting
  // has the new release. Remove only navigation-shell control/cache entries,
  // bound the recovery so WebKit can never leave the button hanging, then force
  // a unique network navigation. The new build re-registers the current worker.
  await releaseLegacyNavigationShell();

  const refreshUrl = new URL(window.location.href);
  refreshUrl.searchParams.set('v', latestPublishedVersion ?? Date.now().toString());
  refreshUrl.searchParams.set('_ms_update', Date.now().toString());
  window.location.replace(refreshUrl.toString());
}

function reloadIntoLatestVersion(button: HTMLButtonElement) {
  button.disabled = true;
  button.textContent = 'Atualizando...';

  window.requestAnimationFrame(() => {
    void navigateToLatestVersion();
  });
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
    reloadIntoLatestVersion(button);
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
    }
  } catch (error) {
    console.warn('[MusicScale] Published version check failed', error);
  }
}

function installReleaseFreshnessGuard() {
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


// Slow downloads remain pending: a timer must never permanently reject React.lazy.
// Real import errors still reach AppErrorBoundary and the existing chunk recovery.
const LazyApp = lazy(async () => {
  const [, appModule] = await Promise.all([
    import('./lib/i18n').then(module => module.i18nReady),
    import('./App'),
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
    <BootLoadingScreen />
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
