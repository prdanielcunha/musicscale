import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, AudioLines, Database, LockKeyhole, RefreshCw, ShieldCheck, UsersRound, WandSparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCapability } from '../../hooks/useCapability';
import { entitlementsService } from '../../services/entitlementsService';
import type { SubscriptionAccessResolution } from '../../utils/subscriptionAccessResolver';
import { logger } from '../../lib/logger';

/**
 * An unavailable MusicScale workspace is not an empty/anonymous workspace.
 * Keep musical data behind the server access gate and send authorized billing
 * operators to the Hub; Stripe purchases never originate from this component.
 */
export const MissingSubscriptionScreen: React.FC<{ resolution?: SubscriptionAccessResolution }> = ({ resolution: propResolution }) => {
  const { loading, refreshSubscriptionAccess, organization, entitlements, isOwner, isGlobalAdmin } = useAuth();
  const { hasCapability } = useCapability();
  const { t } = useTranslation();
  const [isRetrying, setIsRetrying] = React.useState(false);

  const resolution = propResolution || {
    loaded: true, valid: false, status: 'inactive', reason: 'unknown',
    retryable: true, technicalError: false,
  } as SubscriptionAccessResolution;
  const { reason, status, technicalError } = resolution;
  const isExpiredTrial = reason === 'hub_trial_expired' ||
    (entitlements?.entitlementSource === 'hub_internal_trial' && entitlements?.status === 'expired');
  const isPaymentIssue = status === 'payment_failed';
  // Billing capability is distinct from MusicScale song/scale permissions.
  const canManageBilling = isGlobalAdmin || isOwner ||
    hasCapability('organization.billing.manage') || hasCapability('billing.manage');

  const handlePlansRedirect = () => {
    const url = entitlementsService.getMillionsNestBaseUrl();
    window.location.assign(`${url}/dashboard/billing`);
  };
  const handleHubRedirect = () => {
    const url = entitlementsService.getMillionsNestBaseUrl();
    window.location.assign(`${url}/dashboard`);
  };
  const handleRetry = async () => {
    if (isRetrying || loading) return;
    setIsRetrying(true);
    try {
      const result = await refreshSubscriptionAccess();
      logger.info('[MusicScale] Subscription access revalidated', {
        organizationId: organization?.id,
        status: result.status,
        reason: result.reason,
      });
    } catch (error: unknown) {
      logger.error('[MusicScale] Subscription access sync failed', {
        organizationId: organization?.id,
        reason: error instanceof Error ? error.message : 'unknown',
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const heading = technicalError
    ? t('premium.recovery.syncTitle')
    : !canManageBilling
      ? t('premium.recovery.memberTitle')
      : isPaymentIssue
        ? t('premium.recovery.paymentTitle')
        : isExpiredTrial
          ? t('premium.recovery.expiredTitle')
          : t('premium.recovery.unavailableTitle');

  const description = technicalError
    ? t('premium.recovery.syncDescription')
    : !canManageBilling
      ? t('premium.recovery.memberDescription')
      : isPaymentIssue
        ? t('premium.recovery.paymentDescription')
        : t('premium.recovery.expiredDescription');

  return (
    <main
      data-testid="ms-premium-access-recovery"
      className="relative min-h-[100dvh] overflow-x-hidden bg-[#050507] font-sans text-[#f7f7fa]"
      aria-labelledby="recovery-heading"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-80"
        style={{ background: 'radial-gradient(ellipse 90% 32% at 50% 22%, rgba(79,140,255,0.09), transparent 78%), radial-gradient(ellipse 70% 22% at 100% 4%, rgba(120,104,255,0.08), transparent 80%)' }} />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[460px] flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))] sm:px-8">
        <header className="flex items-center gap-3" aria-label="MusicScale">
          <AudioLines className="h-8 w-8 text-[#3ed5dd]" strokeWidth={1.8} aria-hidden="true" />
          <span className="text-[19px] font-semibold tracking-[-0.04em]">MusicScale</span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-10" aria-live={technicalError ? 'polite' : 'off'}>
          <div className="mx-auto mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-[24px] border border-rose-400/15 bg-rose-500/[0.09]">
            {technicalError
              ? <RefreshCw className="h-9 w-9 text-[#a6a6b2]" aria-hidden="true" />
              : <LockKeyhole className="h-9 w-9 text-rose-400" aria-hidden="true" />}
          </div>
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-[#a6a6b2]">
            {technicalError ? t('premium.recovery.verifyingEyebrow') : t('premium.recovery.suspendedEyebrow')}
          </p>
          <h1 id="recovery-heading" className="mx-auto mt-3 max-w-[320px] text-center text-[clamp(27px,7vw,36px)] font-bold leading-[1.1] tracking-[-0.055em]">
            {heading}
          </h1>
          <p className="mx-auto mt-4 max-w-[360px] text-center text-sm leading-6 text-[#a6a6b2]">
            {description}
          </p>

          {!technicalError && (
            <div className="mt-8 flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-[#121218] p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4f8cff]/10 text-[#9bbaff]">
                <Database className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-[13px] font-semibold">{t('premium.recovery.preservedTitle')}</h2>
                <p className="mt-1 text-xs leading-5 text-[#a6a6b2]">
                  {t('premium.recovery.preservedDescription')}
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2">
            {!technicalError && (canManageBilling ? (
              <button
                type="button" onClick={handlePlansRedirect}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4f8cff] to-[#3ed5dd] px-5 text-sm font-bold text-[#050507] transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ed5dd]"
              >
                {t(isPaymentIssue ? 'premium.recovery.regularizeAction' : 'premium.recovery.plansAction')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button" onClick={handleHubRedirect}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#4f8cff] px-5 text-sm font-semibold text-white hover:bg-[#3776ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ed5dd]"
              >
                {t('premium.recovery.hubAction')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button" onClick={handleRetry} disabled={isRetrying || loading}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-[#121218] px-5 text-xs font-medium text-[#f7f7fa] transition-colors hover:bg-[#181820] disabled:cursor-wait disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4f8cff]"
            >
              <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isRetrying ? t('premium.recovery.verifyingAction') : t('premium.recovery.retryAction')}
            </button>
          </div>

          {!technicalError && (
            <section className="mt-8" aria-labelledby="recovery-next-heading">
              <h2 id="recovery-next-heading" className="text-sm font-semibold">{t('premium.recovery.whatNowTitle')}</h2>
              <div className="mt-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d0d11]">
                {[
                  { icon: LockKeyhole, title: 'restrictedMusicTitle', detail: 'restrictedMusicDescription' },
                  { icon: UsersRound, title: 'restrictedTeamTitle', detail: 'restrictedTeamDescription' },
                  { icon: WandSparkles, title: 'restrictedAiTitle', detail: 'restrictedAiDescription' },
                ].map(({ icon: Icon, title, detail }) => (
                  <div key={title} className="flex gap-3 border-b border-white/[0.06] px-4 py-3 last:border-b-0">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#a6a6b2]" aria-hidden="true" />
                    <div>
                      <h3 className="text-xs font-semibold">{t(`premium.recovery.${title}`)}</h3>
                      <p className="mt-1 text-[11px] leading-5 text-[#a6a6b2]">{t(`premium.recovery.${detail}`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>

        <footer className="flex items-center justify-center gap-2 pb-2 text-[11px] text-[#a6a6b2]">
          <ShieldCheck className="h-4 w-4 text-[#3ed5dd]" aria-hidden="true" />
          <span>{t('premium.recovery.hubSecurity')}</span>
        </footer>
      </div>
    </main>
  );
};
