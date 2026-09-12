import { markStartupMetric, incrementStartupCounter, markStartupFailure } from '../../lib/startupTelemetry';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../firebase';

let handoffPromise: Promise<void> | null = null;
const HUB_LAUNCH_URL = 'https://www.millionsnest.com/apps/musicscale/launch';
const RECOVERY_KEY = 'mn_sso_recovery_musicscale';

export function resetHandoffForTesting() {
  handoffPromise = null;
}

function safeReturnPath(): string {
  const path = String(window.location.pathname || '/start').trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://') || path.includes('\\')) {
    return '/start';
  }
  return path;
}

export function redirectToHubLaunch(returnTo = safeReturnPath(), replace = true): void {
  const hubUrl = new URL(HUB_LAUNCH_URL);
  const safePath = returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('://') && !returnTo.includes('\\')
    ? returnTo
    : '/start';
  hubUrl.searchParams.set('returnTo', safePath);
  incrementStartupCounter('redirect_count');
  if (replace) window.location.replace(hubUrl.toString());
  else window.location.assign(hubUrl.toString());
}

function failHandoff(reason: 'expired' | 'invalid' | 'unavailable'): never {
  markStartupFailure('handoff_' + reason);

  // Recover once through the authoritative Hub instead of trapping the user in
  // a second app-specific login. A second failure is fail-closed to avoid loops.
  let alreadyRecovered = false;
  try {
    alreadyRecovered = sessionStorage.getItem(RECOVERY_KEY) === '1';
    if (!alreadyRecovered) sessionStorage.setItem(RECOVERY_KEY, '1');
  } catch {}

  if (!alreadyRecovered) {
    redirectToHubLaunch();
    throw new Error(`Handoff failed: ${reason}`);
  }

  const url = new URL(window.location.origin);
  url.pathname = '/login';
  url.searchParams.set('handoff_error', reason);
  incrementStartupCounter('redirect_count');
  window.location.replace(url.toString());
  throw new Error(`Handoff failed after recovery: ${reason}`);
}

export function consumeHandoff(): Promise<void> {
  if (handoffPromise) return handoffPromise;

  const urlParams = new URLSearchParams(window.location.search);
  const ecosystemCtxStr = urlParams.get('ecosystem_ctx');

  if (!ecosystemCtxStr) return Promise.resolve();

  // Remove the short-lived credential from browser history before decoding or I/O.
  const url = new URL(window.location.href);
  url.searchParams.delete('ecosystem_ctx');
  window.history.replaceState({}, '', url.toString());

  handoffPromise = (async () => {
    if (ecosystemCtxStr.length > 32768) failHandoff('invalid');

    let payload: any;
    try {
      payload = JSON.parse(atob(ecosystemCtxStr));
    } catch {
      failHandoff('invalid');
    }

    if (!payload || typeof payload !== 'object') failHandoff('invalid');
    if (payload.appId !== 'musicscale') failHandoff('invalid');
    if (!payload.protocolVersion || typeof payload.protocolVersion !== 'string' || !payload.protocolVersion.startsWith('1.')) failHandoff('invalid');
    if (!payload.userId || typeof payload.userId !== 'string') failHandoff('invalid');
    if (!payload.customToken || typeof payload.customToken !== 'string' || payload.customToken.length > 16384) failHandoff('invalid');
    if (typeof payload.expiresAt !== 'number') failHandoff('invalid');

    const expiresAtMs = payload.expiresAt > 1e11 ? payload.expiresAt : payload.expiresAt * 1000;
    if (expiresAtMs < Date.now() - 60000) failHandoff('expired');
    if (payload.user && payload.user.uid && payload.user.uid !== payload.userId) failHandoff('invalid');

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), 8000);
      });

      markStartupMetric('handoff_exchange_started_ms');
      const userCredential = await Promise.race([
        signInWithCustomToken(auth, payload.customToken),
        timeoutPromise
      ]) as import('firebase/auth').UserCredential;

      if (timer) clearTimeout(timer);
      if (userCredential.user.uid !== payload.userId) {
        await auth.signOut();
        failHandoff('invalid');
      }

      try { sessionStorage.removeItem(RECOVERY_KEY); } catch {}
      markStartupMetric('handoff_exchange_completed_ms');
    } catch (error: any) {
      if (timer) clearTimeout(timer);
      if (error?.message === 'timeout' || error?.code === 'auth/network-request-failed') failHandoff('unavailable');
      if (error?.code && String(error.code).includes('expired')) failHandoff('expired');
      failHandoff('invalid');
    }
  })();

  return handoffPromise;
}
