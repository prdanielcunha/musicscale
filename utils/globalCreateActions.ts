import { MusicScaleCapability } from '../hooks/useCapability';

export type CreateActionType = 'music-scale' | 'band-scale' | 'song';

export interface CreateAction {
  id: CreateActionType;
  labelKey: string;
  defaultLabel: string;
  descriptionKey: string;
  defaultDescription: string;
  iconType: CreateActionType;
  capability: MusicScaleCapability;
  order: number;
}

export const GLOBAL_CREATE_ACTIONS: CreateAction[] = [
  {
    id: 'music-scale',
    labelKey: 'globalCreate.musicScale.title',
    defaultLabel: 'Escala de músicas',
    descriptionKey: 'globalCreate.musicScale.description',
    defaultDescription: 'Planeje repertório, data e equipe para o próximo culto.',
    iconType: 'music-scale',
    capability: 'musicscale.scales.manage',
    order: 1,
  },
  {
    id: 'band-scale',
    labelKey: 'globalCreate.bandScale.title',
    defaultLabel: 'Escala da banda',
    descriptionKey: 'globalCreate.bandScale.description',
    defaultDescription: 'Organize músicos, funções e instrumentos.',
    iconType: 'band-scale',
    capability: 'musicscale.scales.manage',
    order: 2,
  },
  {
    id: 'song',
    labelKey: 'globalCreate.song.title',
    defaultLabel: 'Música',
    descriptionKey: 'globalCreate.song.description',
    defaultDescription: 'Adicione uma música ao repertório da sua igreja.',
    iconType: 'song',
    capability: 'musicscale.songs.edit',
    order: 3,
  },
];

export function resolveAvailableCreateActions(
  hasCapability: (cap: string) => boolean
): CreateAction[] {
  return GLOBAL_CREATE_ACTIONS.filter(action => hasCapability(action.capability)).sort((a, b) => a.order - b.order);
}
