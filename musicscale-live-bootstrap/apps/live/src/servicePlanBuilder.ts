import type {
  ProviderLink,
  ServiceItem,
  ServicePlan
} from '@musicscale-live/domain';
import type { SharedScale } from './musicScaleBridge';

export interface PreparedSongLink {
  musicScaleSongId: string;
  providerInstanceId: string;
  externalId: string;
  fingerprint?: string;
}

export function buildServicePlan(
  scale: SharedScale,
  scope: {
    venueId: string;
    liveSystemId: string;
  },
  links: PreparedSongLink[] = []
): { plan: ServicePlan; providerLinks: ProviderLink[] } {
  const linksBySong = new Map(links.map(link => [link.musicScaleSongId, link]));
  const providerLinks: ProviderLink[] = links.map(link => ({
    id: `provider-link:${link.providerInstanceId}:${link.musicScaleSongId}`,
    organizationId: scale.organizationId,
    venueId: scope.venueId,
    providerInstanceId: link.providerInstanceId,
    entityType: 'song',
    musicScaleEntityId: link.musicScaleSongId,
    externalId: link.externalId,
    fingerprint: link.fingerprint,
    lastVerifiedAt: new Date().toISOString()
  }));

  const providerLinkIdBySong = new Map(
    providerLinks.map(link => [link.musicScaleEntityId || '', link.id])
  );

  const items: ServiceItem[] = scale.songs.map((song, index) => {
    const link = linksBySong.get(song.id);
    return {
      id: `song:${song.id}`,
      type: 'song',
      title: song.title,
      sourceEntityId: song.id,
      providerLinkId: providerLinkIdBySong.get(song.id),
      state: link ? 'prepared' : 'planned',
      payload: {
        order: index + 1,
        artist: song.artist || null,
        key: song.selectedKey || song.key || null,
        bpm: song.selectedBpm ?? song.bpm ?? null
      }
    };
  });

  const scheduledAt = `${scale.date}T${scale.time || '00:00'}:00`;

  const plan: ServicePlan = {
    id: `music-scale:${scale.id}`,
    organizationId: scale.organizationId,
    venueId: scope.venueId,
    liveSystemId: scope.liveSystemId,
    sourceMusicScaleId: scale.id,
    title: scale.eventName || 'Culto',
    scheduledAt,
    items,
    revision: Math.max(1, scale.publishRevision || 1)
  };

  return { plan, providerLinks };
}
