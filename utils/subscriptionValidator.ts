import { MusicScaleEntitlements } from '../services/entitlementsService';
import { Organization } from '../types';

export interface SubscriptionContext {
  entitlements?: MusicScaleEntitlements | null;
  organization?: Organization | null;
  subscription?: { status?: string; subscriptionEndsAt?: number; currentPeriodEnd?: number; plan?: string } | null;
}

export function isMusicScaleSubscriptionValid(context: SubscriptionContext): boolean {
  const statusList = [
    context.entitlements?.status,
    context.subscription?.status
  ].filter(Boolean).map(s => String(s).toLowerCase().trim());

  if (statusList.includes('active') || statusList.includes('trialing')) {
    return true;
  }

  // Handle canceled/cancelAtPeriodEnd where it's still in grace period
  if (statusList.includes('canceled')) {
    const rawPeriodEnd = 
      context.entitlements?.currentPeriodEnd || 
      context.subscription?.subscriptionEndsAt || 
      (context.subscription as any)?.currentPeriodEnd || 
      0;

    const periodEnd = typeof rawPeriodEnd === 'string' ? parseFloat(rawPeriodEnd) : (rawPeriodEnd as number);
    
    if (periodEnd > 0) {
      const now = Math.floor(Date.now() / 1000);
      let normalizedPeriodEnd = periodEnd;
      if (periodEnd > 9999999999) {
         normalizedPeriodEnd = Math.floor(periodEnd / 1000);
      }
      if (normalizedPeriodEnd > now) {
        return true;
      }
    }
  }

  return false;
}

export function getSubscriptionBlockReason(context: SubscriptionContext): { reason: string; message: string; banner?: string; valid: boolean } {
  const statusList = [
    context.entitlements?.status,
    context.subscription?.status
  ].filter(Boolean).map(s => String(s).toLowerCase().trim());

  if (statusList.includes('active') || statusList.includes('trialing')) {
     return { valid: true, reason: 'valid', message: '' };
  }

  const rawPeriodEnd = 
    context.entitlements?.currentPeriodEnd || 
    context.subscription?.subscriptionEndsAt || 
    (context.subscription as any)?.currentPeriodEnd || 
    0;

  const periodEnd = typeof rawPeriodEnd === 'string' ? parseFloat(rawPeriodEnd) : (rawPeriodEnd as number);

  if (statusList.includes('canceled')) {
    let normalizedPeriodEnd = periodEnd;
    if (periodEnd > 9999999999) {
       normalizedPeriodEnd = Math.floor(periodEnd / 1000);
    }
    const now = Math.floor(Date.now() / 1000);

    if (normalizedPeriodEnd > now) {
       const dateStr = new Date(normalizedPeriodEnd * 1000).toLocaleDateString('pt-BR');
       return { 
          valid: true,
          reason: 'valid_until_period_end', 
          message: `Válida até ${dateStr}`,
          banner: `Sua assinatura está ativa até ${dateStr}. Para alterar ou reativar seu plano, acesse o MillionsNest.` 
       };
    }
    return { valid: false, reason: 'invalid_canceled', message: 'Sua assinatura está cancelada e o período de acesso encerrou.' };
  }

  if (statusList.some(s => ['expired', 'incomplete_expired', 'past_due', 'unpaid'].includes(s))) {
     return { valid: false, reason: 'invalid_payment_failed', message: 'Houve um problema com pagamento ou a assinatura está vencida.' };
  }

  if (statusList.includes('inactive')) {
     return { valid: false, reason: 'invalid_inactive', message: 'Não encontramos uma assinatura ou acesso ativo.' };
  }

  return { valid: false, reason: 'invalid_missing', message: 'Não encontramos uma assinatura ou acesso ativo.' };
}
