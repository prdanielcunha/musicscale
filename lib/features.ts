import { SubscriptionFeatures } from '../types';

const defaultFeatures: SubscriptionFeatures = {
  globalLibrary: false,
  globalImports: false,
};

const proFeatures: SubscriptionFeatures = {
  globalLibrary: true,
  globalImports: true,
};

export const PLAN_FEATURES: Record<string, SubscriptionFeatures> = {
  free: defaultFeatures,
  starter: defaultFeatures,
  pro: proFeatures,
};

export function getFeaturesForPlan(plan?: string | null): SubscriptionFeatures {
  const normalizedPlan = (plan || 'starter').toLowerCase();
  return PLAN_FEATURES[normalizedPlan] || PLAN_FEATURES.starter;
}
