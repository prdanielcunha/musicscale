import { markStartupMetric, incrementStartupCounter, markStartupFailure } from '../../lib/startupTelemetry';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../firebase';

let handoffPromise: Promise<void> | null = null;

export function resetHandoffForTesting() {
  handoffPromise = null;
}

function failHandoff(reason: 'expired' | 'invalid' | 'unavailable'): never {
  markStartupFailure('handoff_' + reason);
  const url = new URL(window.location.origin);
  url.pathname = '/login';
  url.searchParams.set('handoff_error', reason);
  incrementStartupCounter('redirect_count');
  window.location.replace(url.toString());
  throw new Error(`Handoff failed: ${reason}`); // Stop execution
}

export function consumeHandoff(): Promise<void> {
  if (handoffPromise) {
    return handoffPromise;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const ecosystemCtxStr = urlParams.get('ecosystem_ctx');

  if (!ecosystemCtxStr) {
    return Promise.resolve();
  }

  // Ensure URL is immediately updated before any async or decoding
  const url = new URL(window.location.href);
  url.searchParams.delete('ecosystem_ctx');
  window.history.replaceState({}, '', url.toString());

  handoffPromise = (async () => {
    if (ecosystemCtxStr.length > 32768) {
      failHandoff('invalid');
    }

    let payload: any;
    try {
      const decoded = atob(ecosystemCtxStr);
      payload = JSON.parse(decoded);
    } catch (e) {
      failHandoff('invalid');
    }

    if (!payload || typeof payload !== 'object') {
      failHandoff('invalid');
    }

    if (payload.appId !== 'musicscale') {
      failHandoff('invalid');
    }

    if (!payload.protocolVersion || typeof payload.protocolVersion !== 'string' || !payload.protocolVersion.startsWith('1.')) {
      failHandoff('invalid');
    }

    if (!payload.userId || typeof payload.userId !== 'string') {
      failHandoff('invalid');
    }

    if (!payload.customToken || typeof payload.customToken !== 'string' || payload.customToken.length > 16384) {
      failHandoff('invalid');
    }

    if (typeof payload.expiresAt !== 'number') {
      failHandoff('invalid');
    }

    // Handle both ms and seconds based on magnitude
    const expiresAtMs = payload.expiresAt > 1e11 ? payload.expiresAt : payload.expiresAt * 1000;
    if (expiresAtMs < Date.now() - 60000) {
      failHandoff('expired');
    }

    if (payload.user && payload.user.uid && payload.user.uid !== payload.userId) {
      failHandoff('invalid');
    }

    let timer: any;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), 8000);
      });

      markStartupMetric('handoff_exchange_started_ms');
      const userCredential = await Promise.race([
        signInWithCustomToken(auth, payload.customToken),
        timeoutPromise
      ]) as import('firebase/auth').UserCredential;

      clearTimeout(timer);

      if (userCredential.user.uid !== payload.userId) {
         // Should never happen normally, but strict check requested
         await auth.signOut();
         failHandoff('invalid');
      }
      markStartupMetric('handoff_exchange_completed_ms');
    } catch (error: any) {
      clearTimeout(timer);
      if (error.message === 'timeout' || error.code === 'auth/network-request-failed') {
        failHandoff('unavailable');
      }
      if (error.code && error.code.includes('expired')) {
        failHandoff('expired');
      }
      failHandoff('invalid');
    }
  })();

  return handoffPromise;
}
