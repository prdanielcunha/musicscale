import type { Capability } from './types';

export type ProviderRouteGroup =
  | 'presentation'
  | 'songs'
  | 'bible'
  | 'media'
  | 'stage'
  | 'visual'
  | 'audio'
  | 'automation';

export function routeGroupForCapability(
  capability: Capability
): ProviderRouteGroup {
  if (
    capability.startsWith('presentation.') ||
    capability === 'preview.snapshot'
  ) {
    return 'presentation';
  }
  if (capability.startsWith('songs.') || capability.startsWith('playlist.')) {
    return 'songs';
  }
  if (capability.startsWith('bible.')) return 'bible';
  if (capability.startsWith('media.')) return 'media';
  if (capability.startsWith('stage.')) return 'stage';
  if (capability.startsWith('visual.')) return 'visual';
  if (capability.startsWith('audio.')) return 'audio';
  return 'automation';
}
