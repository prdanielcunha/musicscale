import { MusicScalePlan, MusicScaleFeatures, PLAN_FEATURES, PLAN_LIMITS } from '../services/entitlementsService';

export interface PlanPricingDetail {
  name: string;
  price: string;
  pricePeriod: string;
  badge?: string;
  isPopular?: boolean;
}

export const PLAN_PRICING_DETAILS: Record<MusicScalePlan, PlanPricingDetail> = {
  starter: {
    name: 'Starter',
    price: 'R$ 19,90',
    pricePeriod: 'mês',
    badge: 'Essencial',
  },
  advanced: {
    name: 'Advanced',
    price: 'R$ 29,90',
    pricePeriod: 'mês',
    badge: 'Intermediário',
  },
  pro: {
    name: 'Pro',
    price: 'R$ 34,90',
    pricePeriod: 'mês',
    badge: 'Mais Vendido / Recomendado',
    isPopular: true,
  },
};

/**
 * Normalizes old plan names to our official canonical set
 */
export function normalizeLegacyPlanName(plan: string | undefined | null): MusicScalePlan {
  if (!plan) return 'starter';
  const p = plan.toLowerCase();
  if (p === 'pro' || p === 'premium' || p === 'pro_unlimited') return 'pro';
  if (p === 'advanced' || p === 'medium' || p === 'advanced_features') return 'advanced';
  return 'starter';
}

/**
 * Helper to fetch fallback limits for legacy code compatibility
 */
export function getOrganizationLimits(planName: string | undefined | null) {
  const normalized = normalizeLegacyPlanName(planName);
  const limits = PLAN_LIMITS[normalized];
  return {
    maxMembers: limits.users === -1 ? Infinity : limits.users,
    maxSongs: limits.songs === -1 ? Infinity : limits.songs,
    maxScales: limits.scales === -1 ? Infinity : limits.scales,
    maxBandScales: limits.bandScales === -1 ? Infinity : limits.bandScales,
    addonsAllowed: normalized === 'pro',
  };
}

export function hasAddon(addons: string[] | undefined, addonCode: string): boolean {
  if (!addons || !Array.isArray(addons)) return false;
  return addons.includes(addonCode);
}

/**
 * Returns localized premium informational text / messages for custom block screens
 */
export function getLockedFeatureMessage(
  featureKey: keyof MusicScaleFeatures,
  currentPlan: MusicScalePlan = 'starter'
): {
  title: string;
  description: string;
  requiredPlan: MusicScalePlan;
} {
  // 1. Starter trying to access Biblioteca Viva
  if (['libraryAccess'].includes(featureKey)) {
    return {
      title: 'Biblioteca Viva disponível no Advanced',
      description: 'Importe músicas prontas, com letra, cifra, tom e BPM, e acelere a preparação do repertório.',
      requiredPlan: 'advanced',
    };
  }

  // 2. Starter trying to import (or similar limited/complete library keys)
  if (['libraryLimited', 'libraryComplete'].includes(featureKey)) {
    if (currentPlan === 'starter') {
      return {
        title: 'Biblioteca Viva disponível no Advanced',
        description: 'Importe músicas prontas, com letra, cifra, tom e BPM, e acelere a preparação do repertório.',
        requiredPlan: 'advanced',
      };
    } else {
      // Advanced having reached the limit or trying to get unlimited complete library
      return {
        title: 'Limite mensal de importações atingido',
        description: 'Sua organização já importou as 10 músicas permitidas este mês no plano Advanced. Faça upgrade para o Pro para ter importações ilimitadas.',
        requiredPlan: 'pro',
      };
    }
  }

  // 3. IA access & Scale cloning: Starter or Advanced trying to use IA
  if (['aiImport', 'aiStructuring', 'aiSuggestions', 'aiSetlistInsights', 'scaleCloning'].includes(featureKey as string)) {
    return {
      title: 'Recurso Premium',
      description: 'A estruturação/clonagem inteligente requer o plano Pro. Assine hoje para automatizar seu ministério.',
      requiredPlan: 'pro',
    };
  }

  if (featureKey === 'usersLimit' as any) {
    if (currentPlan === 'starter') {
      return {
        title: 'Limite de usuários do Starter',
        description: 'Seu plano Starter permite até 10 usuários. Faça upgrade para o Advanced ou Pro para continuar expandindo sua equipe.',
        requiredPlan: 'advanced',
      };
    } else {
      return {
        title: 'Cresça sem limite com o Pro',
        description: 'Seu plano Advanced permite até 20 usuários. No Pro, sua organização pode crescer sem limite de pessoas.',
        requiredPlan: 'pro',
      };
    }
  }

  if (featureKey === 'songsLimit' as any) {
    return {
      title: 'Limite de músicas atingido',
      description: 'O seu plano atual atingiu o limite de músicas cadastradas. Faça upgrade para continuar expandindo seu repertório.',
      requiredPlan: currentPlan === 'starter' ? 'advanced' : 'pro',
    };
  }

  if (featureKey === 'bandScalesLimit' as any) {
    return {
      title: 'Limite de equipes atingido',
      description: 'O seu plano atual atingiu o limite máximo de membros escaláveis ou de equipes. Faça upgrade para expandir as organizações do seu ministério.',
      requiredPlan: currentPlan === 'starter' ? 'advanced' : 'pro',
    };
  }

  // 5. Full history: Starter trying full history
  if (featureKey === 'fullHistory') {
    return {
      title: 'Histórico Completo de Escalas',
      description: 'Histórico completo está disponível a partir do Advanced.',
      requiredPlan: 'advanced',
    };
  }

  // 6. Advanced repertoire customization
  if (featureKey === 'advancedRepertoireCustomization') {
    return {
      title: 'Personalização Avançada',
      description: 'Personalização avançada de repertório está disponível a partir do Advanced.',
      requiredPlan: 'advanced',
    };
  }

  // Default fallback
  return {
    title: 'Recurso Avançado',
    description: 'Este recurso faz parte dos planos premium do MusicScale no ecossistema MillionsNest.',
    requiredPlan: 'advanced',
  };
}
