export type SubscriptionAccessResolution = {
  loaded: boolean;
  valid: boolean;
  status:
    | 'loading'
    | 'active'
    | 'trialing'
    | 'canceled_grace'
    | 'inactive'
    | 'payment_failed'
    | 'repair_required'
    | 'unauthorized'
    | 'forbidden'
    | 'unavailable'
    | 'unknown';
  reason: string;
  source?: 'subscription' | 'entitlements' | 'app_cache' | 'none';
  organizationId?: string | null;
  message?: string;
  retryable: boolean;
  technicalError?: boolean;
};

export function resolveSubscriptionAccess(
  isAuthLoading: boolean,
  isSubscriptionLoaded: boolean,
  isEntitlementsLoaded: boolean,
  contextValidation: any,
  isGlobalAdmin: boolean
): SubscriptionAccessResolution {
  if (isAuthLoading || !isSubscriptionLoaded || !isEntitlementsLoaded) {
    return {
      loaded: false,
      valid: true,
      status: 'loading',
      reason: 'loading',
      retryable: false,
      technicalError: false
    };
  }

  // Bypass para admin global
  if (isGlobalAdmin) {
    return {
      loaded: true,
      valid: true,
      status: 'active',
      reason: 'global_admin_bypass',
      source: 'none',
      retryable: false,
      technicalError: false
    };
  }

  const statusList = [
    contextValidation.entitlements?.status,
    contextValidation.subscription?.status
  ].filter(Boolean).map(s => String(s).toLowerCase().trim());

  if (statusList.includes('active') || statusList.includes('trialing')) {
    return {
      loaded: true,
      valid: true,
      status: statusList.includes('active') ? 'active' : 'trialing',
      reason: 'valid_status',
      source: 'entitlements',
      organizationId: contextValidation.organization?.id,
      retryable: false,
      technicalError: false
    };
  }

  const rawPeriodEnd =
    contextValidation.entitlements?.currentPeriodEnd ||
    contextValidation.subscription?.subscriptionEndsAt ||
    (contextValidation.subscription as any)?.currentPeriodEnd ||
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
        loaded: true,
        valid: true,
        status: 'canceled_grace',
        reason: 'valid_until_period_end',
        message: `Válida até ${dateStr}`,
        source: 'entitlements',
        organizationId: contextValidation.organization?.id,
        retryable: false,
        technicalError: false
      };
    }
    return {
      loaded: true,
      valid: false,
      status: 'inactive',
      reason: 'invalid_canceled',
      message: 'Sua assinatura está cancelada e o período de acesso encerrou.',
      source: 'entitlements',
      organizationId: contextValidation.organization?.id,
      retryable: true,
      technicalError: false
    };
  }

  if (statusList.some(s => ['expired', 'incomplete_expired', 'past_due', 'unpaid'].includes(s))) {
    return {
      loaded: true,
      valid: false,
      status: 'payment_failed',
      reason: 'invalid_payment_failed',
      message: 'Houve um problema com pagamento ou a assinatura está vencida.',
      source: 'entitlements',
      organizationId: contextValidation.organization?.id,
      retryable: true,
      technicalError: false
    };
  }

  if (statusList.includes('repair_required')) {
      return {
          loaded: true,
          valid: false,
          status: 'repair_required',
          reason: 'repair_required',
          message: 'Sua assinatura precisa de reparo no MillionsNest.',
          source: 'entitlements',
          organizationId: contextValidation.organization?.id,
          retryable: true,
          technicalError: true
      };
  }
  
  if (statusList.includes('unauthorized') || statusList.includes('401')) {
      return {
          loaded: true,
          valid: false,
          status: 'unauthorized',
          reason: 'unauthorized',
          message: 'Sua sessão expirou e precisa ser atualizada.',
          source: 'entitlements',
          organizationId: contextValidation.organization?.id,
          retryable: true,
          technicalError: true
      };
  }
  
  if (statusList.includes('forbidden') || statusList.includes('403')) {
      return {
          loaded: true,
          valid: false,
          status: 'forbidden',
          reason: 'forbidden',
          message: 'Você não tem permissão para acessar esta organização.',
          source: 'entitlements',
          organizationId: contextValidation.organization?.id,
          retryable: true,
          technicalError: true
      };
  }
  
  if (statusList.includes('unavailable') || statusList.includes('500') || statusList.includes('503')) {
      return {
          loaded: true,
          valid: false,
          status: 'unavailable',
          reason: 'unavailable',
          message: 'Serviço temporariamente indisponível.',
          source: 'entitlements',
          organizationId: contextValidation.organization?.id,
          retryable: true,
          technicalError: true
      };
  }

  if (statusList.includes('inactive')) {
    return {
      loaded: true,
      valid: false,
      status: 'inactive',
      reason: 'invalid_inactive',
      message: 'Não encontramos uma assinatura ou acesso ativo.',
      source: 'entitlements',
      organizationId: contextValidation.organization?.id,
      retryable: true,
      technicalError: false
    };
  }

  return {
    loaded: true,
    valid: false,
    status: 'inactive',
    reason: 'invalid_missing',
    message: 'Não encontramos uma assinatura ou acesso ativo.',
    source: 'entitlements',
    organizationId: contextValidation.organization?.id,
    retryable: true,
    technicalError: false
  };
}
