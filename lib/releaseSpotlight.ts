import type { ReleaseAction } from './appRelease';

/**
 * Curated MusicScale product milestones. Not a chronological changelog: these
 * remain visible after a release is acknowledged and after future hotfixes.
 * Only link to routes that are part of the authenticated app.
 */
export const PINNED_PRODUCT_HIGHLIGHTS = [
  {
    id: 'tuner',
    translationKey: 'nestTunerBeta010',
    titleKey: 'releaseNews.pinned.tuner',
    descriptionKey: 'releaseNews.nestTunerBeta010.description',
    howKey: 'releaseNews.nestTunerBeta010.stageTools.how',
    action: { kind: 'internal', to: '/stage-tools/tuner' },
  },
  {
    id: 'pad',
    translationKey: 'stageToolsBeta02',
    titleKey: 'releaseNews.pinned.pad',
    descriptionKey: 'releaseNews.stageToolsBeta02.description',
    howKey: 'releaseNews.stageToolsBeta02.deviceAudio.how',
    action: { kind: 'internal', to: '/stage-tools' },
  },
  {
    id: 'medley',
    translationKey: 'intelligentMedleysBeta08',
    titleKey: 'releaseNews.pinned.medley',
    descriptionKey: 'releaseNews.intelligentMedleysBeta08.description',
    howKey: 'releaseNews.intelligentMedleysBeta08.stageTools.how',
    action: { kind: 'internal', to: '/scales' },
  },
] as const satisfies readonly {
  id: string;
  translationKey: string;
  titleKey: string;
  descriptionKey: string;
  howKey: string;
  action: ReleaseAction;
}[];

/**
 * Minor release notes remain separate and collapsed. These keys refer to
 * published, localized release copy rather than speculative marketing text.
 */
export const RELEASE_DETAIL_GROUPS = [
  'nestTunerBeta010',
  'canonicalInvitesBeta09',
  'fixedBandWorkflowBeta07',
] as const;
