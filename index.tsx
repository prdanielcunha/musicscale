
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';

import { AppErrorBoundary } from './components/AppErrorBoundary';
import { markStartupMetric, incrementStartupCounter, markStartupFailure } from './lib/startupTelemetry';


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
  

const fallbackLoader = (
  <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#050505', color: 'white', position: 'relative', overflow: 'hidden' }}>
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
