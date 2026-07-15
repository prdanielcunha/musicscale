export type MusicScalePlan = 'starter' | 'advanced' | 'pro';

export interface MusicScaleFeatures {
  songsUnlimited: boolean;
  scalesUnlimited: boolean;
  basicSongFields: boolean;
  cloudSync: boolean;
  shareScales: boolean;
  libraryAccess: boolean;
  libraryLimited: boolean;
  libraryComplete: boolean;
  aiImport: boolean;
  aiStructuring: boolean;
  aiSuggestions: boolean;
  aiSetlistInsights: boolean;
  scaleCloning: boolean;
  fullHistory: boolean;
  advancedRepertoireCustomization: boolean;
  futurePremiumFeatures: boolean;
  priorityNewFeatures: boolean;
}

export interface MusicScaleLimits {
  users: number; // -1 = unlimited
  songs: number;
  scales: number;
  bandScales: number;
  libraryImportsPerMonth: number;
}

export interface MusicScaleUsage {
  libraryImports: number;
  users?: number;
}

export interface MusicScaleEntitlements {
  organizationId: string;
  app: 'musicscale';
  plan: MusicScalePlan;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired' | 'inactive' | 'none';
  features: MusicScaleFeatures;
  limits: MusicScaleLimits;
  usage: MusicScaleUsage;
  supportTier: 'standard' | 'basic_priority' | 'priority';
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  planUpdatedAt: string | null;
  entitlementsVersion: number;
}

export const PLAN_FEATURES: Record<MusicScalePlan, MusicScaleFeatures> = {
  starter: {
    songsUnlimited: true,
    scalesUnlimited: true,
    basicSongFields: true,
    cloudSync: true,
    shareScales: true,
    libraryAccess: false,
    libraryLimited: false,
    libraryComplete: false,
    aiImport: false,
    aiStructuring: false,
    aiSuggestions: false,
    aiSetlistInsights: false,
    scaleCloning: false,
    fullHistory: false,
    advancedRepertoireCustomization: false,
    futurePremiumFeatures: false,
    priorityNewFeatures: false,
  },
  advanced: {
    songsUnlimited: true,
    scalesUnlimited: true,
    basicSongFields: true,
    cloudSync: true,
    shareScales: true,
    libraryAccess: true,
    libraryLimited: true,
    libraryComplete: false,
    aiImport: false,
    aiStructuring: false,
    aiSuggestions: false,
    aiSetlistInsights: false,
    scaleCloning: false,
    fullHistory: true,
    advancedRepertoireCustomization: true,
    futurePremiumFeatures: false,
    priorityNewFeatures: false,
  },
  pro: {
    songsUnlimited: true,
    scalesUnlimited: true,
    basicSongFields: true,
    cloudSync: true,
    shareScales: true,
    libraryAccess: true,
    libraryLimited: true,
    libraryComplete: true,
    aiImport: true,
    aiStructuring: true,
    aiSuggestions: true,
    aiSetlistInsights: true,
    scaleCloning: true,
    fullHistory: true,
    advancedRepertoireCustomization: true,
    futurePremiumFeatures: true,
    priorityNewFeatures: true,
  },
};

export const PLAN_LIMITS: Record<MusicScalePlan, MusicScaleLimits> = {
  starter: {
    users: 10,
    songs: -1,
    scales: -1,
    bandScales: -1,
    libraryImportsPerMonth: 0,
  },
  advanced: {
    users: 20,
    songs: -1,
    scales: -1,
    bandScales: -1,
    libraryImportsPerMonth: 10,
  },
  pro: {
    users: -1,
    songs: -1,
    scales: -1,
    bandScales: -1,
    libraryImportsPerMonth: -1,
  },
};

export const DEFAULT_USAGE: MusicScaleUsage = {
  libraryImports: 0,
};
