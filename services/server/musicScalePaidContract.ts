/**
 * This exception is ONLY for organizations already marked by Hub as
 * `hub_internal_trial`. Other products' Stripe subscriptions cannot
 * reactivate an expired MusicScale trial.
 *
 * Legacy MusicScale-only root contracts remain supported only when explicitly
 * labeled `app: "musicscale"`. Absence of app identity is NOT proof.
 */
export function resolvePaidMusicScaleContract(subscription: unknown): {
  valid: boolean; status: 'active' | 'trialing' | null; plan: string | null;
  currentPeriodEnd: unknown | null;
} {
  const missing = { valid: false, status: null, plan: null, currentPeriodEnd: null } as const;
  if (!subscription || typeof subscription !== 'object') return missing;
  const s = subscription as Record<string, any>;
  const app = s.apps?.musicscale && typeof s.apps.musicscale === 'object'
    ? s.apps.musicscale : null;
  const candidate = app || (s.app === 'musicscale' ? s : null);
  if (!candidate) return missing;
  const status = String(candidate.status || '').toLowerCase().trim();
  const stripeId = candidate.stripeSubscriptionId;
  if (!['active', 'trialing'].includes(status) || typeof stripeId !== 'string' ||
      !stripeId.trim()) return missing;
  return {
    valid: true, status: status as 'active'|'trialing',
    plan: typeof candidate.plan === 'string' ? candidate.plan : null,
    currentPeriodEnd: candidate.currentPeriodEnd ?? candidate.subscriptionEndsAt ?? null,
  };
}
