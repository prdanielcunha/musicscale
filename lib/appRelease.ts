import { version } from '../package.json';

export const APP_VERSION = version;
// Keep this ID across hotfixes. Only a meaningful new feature gets a new announcement.
export const FEATURE_RELEASE = {
  id: 'premium-v2-beta-0.1',
  version: '0.1.0-beta',
  publishedAt: '2026-09-15T00:00:00Z',
  translationKey: 'releaseNews.premiumV2',
} as const;
