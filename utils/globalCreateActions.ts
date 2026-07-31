export type GlobalCreateActionGroup = 'songs' | 'scales';
export type GlobalCreateActionId = 'ai-song-import' | 'library-song-import' | 'song-manual' | 'music-scale' | 'band-scale';
export type GlobalCreateAvailability = 'enabled' | 'plan-locked' | 'limit-reached' | 'hidden';

export interface GlobalCreateAction {
  id: GlobalCreateActionId;
  group: GlobalCreateActionGroup;
  labelKey: string;
  defaultLabel: string;
  descriptionKey: string;
  defaultDescription: string;
  iconType: GlobalCreateActionId;
  capability: string;
  order: number;
  badgeKey?: string;
  defaultBadge?: string;
}

export interface ResolvedGlobalCreateAction extends GlobalCreateAction {
  availability: GlobalCreateAvailability;
}

export const GLOBAL_CREATE_ACTIONS: GlobalCreateAction[] = [
  {
    id: 'music-scale',
    group: 'scales',
    labelKey: 'globalCreate.musicScale.title',
    defaultLabel: 'Criar escala de músicas',
    descriptionKey: 'globalCreate.musicScale.description',
    defaultDescription: 'Planeje repertório, data e equipe.',
    iconType: 'music-scale',
    capability: 'musicscale.scales.manage',
    order: 1
  },
  {
    id: 'band-scale',
    group: 'scales',
    labelKey: 'globalCreate.bandScale.title',
    defaultLabel: 'Criar escala da banda',
    descriptionKey: 'globalCreate.bandScale.description',
    defaultDescription: 'Organize músicos, funções e instrumentos.',
    iconType: 'band-scale',
    capability: 'musicscale.scales.manage',
    order: 2
  },
  {
    id: 'ai-song-import',
    group: 'songs',
    labelKey: 'globalCreate.aiImport.title',
    defaultLabel: 'Importar com IA',
    descriptionKey: 'globalCreate.aiImport.description',
    defaultDescription: 'Use a IA para encontrar e preencher os dados da música.',
    iconType: 'ai-song-import',
    capability: 'musicscale.songs.edit',
    order: 3,
    badgeKey: 'globalCreate.badges.fast',
    defaultBadge: 'Rápido'
  },
  {
    id: 'library-song-import',
    group: 'songs',
    labelKey: 'globalCreate.libraryImport.title',
    defaultLabel: 'Buscar na Biblioteca Viva',
    descriptionKey: 'globalCreate.libraryImport.description',
    defaultDescription: 'Importe uma música pronta para o repertório.',
    iconType: 'library-song-import',
    capability: 'musicscale.songs.edit',
    order: 4
  },
  {
    id: 'song-manual',
    group: 'songs',
    labelKey: 'globalCreate.songManual.title',
    defaultLabel: 'Adicionar manualmente',
    descriptionKey: 'globalCreate.songManual.description',
    defaultDescription: 'Cadastre a música com seus próprios dados.',
    iconType: 'song-manual',
    capability: 'musicscale.songs.edit',
    order: 5
  }
];

export interface ResolveGlobalCreateActionsParams {
  hasCapability: (cap: string) => boolean;
  aiImportAvailability: GlobalCreateAvailability;
  libraryAvailability: GlobalCreateAvailability;
  songLimitReached: boolean;
}

export function resolveGlobalCreateActions({
  hasCapability,
  aiImportAvailability,
  libraryAvailability,
  songLimitReached
}: ResolveGlobalCreateActionsParams): ResolvedGlobalCreateAction[] {
  const resolved: ResolvedGlobalCreateAction[] = [];

  for (const action of GLOBAL_CREATE_ACTIONS) {
    if (!hasCapability(action.capability)) {
      continue;
    }

    let availability: GlobalCreateAvailability = 'enabled';

    if (action.id === 'ai-song-import') {
      if (aiImportAvailability === 'hidden') continue;
      availability = aiImportAvailability;
    } else if (action.id === 'library-song-import') {
      if (libraryAvailability === 'hidden') continue;
      availability = libraryAvailability;
    }

    // Apply global song limit check
    if (action.group === 'songs' && songLimitReached && availability === 'enabled') {
      availability = 'limit-reached';
    }

    resolved.push({
      ...action,
      availability
    });
  }

  return resolved.sort((a, b) => a.order - b.order);
}
