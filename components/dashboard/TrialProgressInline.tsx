import React from 'react';
import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MusicScaleEntitlements } from '../../services/entitlementsConstants';

/** The server-issued effective deadline (including extensions) is the only
 * source used here. UI time is informational, never an authorization gate. */
export function remainingTrialDays(endsAt: string | null | undefined, now = Date.now()): number | null {
  if (!endsAt || !Number.isFinite(now)) return null;
  const end = Date.parse(endsAt);
  if (!Number.isFinite(end) || end <= now) return null;
  return Math.ceil((end - now) / 86_400_000);
}

interface TrialProgressInlineProps {
  entitlement: MusicScaleEntitlements | null;
  isBillingManager: boolean;
}

export function TrialProgressInline({ entitlement, isBillingManager }: TrialProgressInlineProps) {
  const { t, i18n } = useTranslation();
  // Visual rollout is independent of the underlying entitlement/grant flags.
  if (import.meta.env.VITE_NEW_TRIAL_UI_PRESENTATION !== 'true' || !isBillingManager ||
      entitlement?.entitlementSource !== 'hub_internal_trial' ||
      entitlement.status !== 'trialing') return null;

  const days = remainingTrialDays(entitlement.trialEndsAt);
  if (days === null) return null;

  const language = i18n.resolvedLanguage || i18n.language || 'pt-BR';
  const locale = language.startsWith('pt') ? 'pt-BR'
    : language.startsWith('es') ? 'es-ES' : 'en-US';
  const endDate = new Intl.DateTimeFormat(locale, {day:'numeric',month:'short'})
    .format(new Date(entitlement.trialEndsAt!));

  return (
    <aside
      data-testid="ms-trial-progress-inline"
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-[#4f8cff]/20 bg-[#121218] px-4 py-3 text-[#f7f7fa]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4f8cff]/10 text-[#3ed5dd]">
          <CalendarClock className="h-[18px] w-[18px]" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold">{t('dashboardTrial.active')}</p>
          <p className="text-[11px] text-[#a6a6b2]">
            {t('dashboardTrial.daysRemaining', { count: days })}
          </p>
        </div>
      </div>
      <time dateTime={entitlement.trialEndsAt!} className="text-[11px] font-medium text-[#a6a6b2]">
        {t('dashboardTrial.effectiveUntil', {date:endDate})}
      </time>
    </aside>
  );
}
