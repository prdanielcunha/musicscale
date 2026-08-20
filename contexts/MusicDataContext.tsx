import React, { createContext, useContext, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { Scale, EventType, Location, PopulatedScale, EventName, Tag, PopulatedSong, Role, Instrument, BandScale, PopulatedBandScale, UserProfile, FixedBandScale } from '../types';
import { useMusicData, type UsersStatus } from '../hooks/useMusicData';
import { useAuth } from './AuthContext';
import { useOffline } from './OfflineContext';
import {
  readOfflineStageReadCache,
  writeOfflineStageReadCache,
  type OfflineStageReadSnapshot,
} from '../services/offline/stageReadCache';
import { logger } from '../lib/logger';

interface MusicDataContextType {
  songs: PopulatedSong[];
  scales: Scale[];
  populatedScales: PopulatedScale[];
  bandScales: BandScale[];
  populatedBandScales: PopulatedBandScale[];
  eventTypes: EventType[];
  locations: Location[];
  eventNames: EventName[];
  tags: Tag[];
  roles: Role[];
  instruments: Instrument[];
  allUsers: UserProfile[];
  usersStatus: UsersStatus;
  fixedBandScales: FixedBandScale[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const MusicDataContext = createContext<MusicDataContextType | undefined>(undefined);

interface ScopedOfflineSnapshot {
  organizationId: string;
  data: OfflineStageReadSnapshot;
}

export const MusicDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const musicData = useMusicData();
  const { effectiveOrganizationId } = useAuth();
  const { isOffline } = useOffline();
  const [offlineSnapshot, setOfflineSnapshot] = useState<ScopedOfflineSnapshot | null>(null);
  const [offlineFallbackActive, setOfflineFallbackActive] = useState(false);
  const cacheReadGenerationRef = useRef(0);
  const wasOfflineRef = useRef(isOffline);

  // IndexedDB is a read fallback only. It never establishes tenant authority:
  // the active organization must already come from the canonical auth context.
  useEffect(() => {
    const generation = ++cacheReadGenerationRef.current;
    const organizationId = effectiveOrganizationId;

    setOfflineSnapshot(null);
    setOfflineFallbackActive(false);
    if (!organizationId) return;

    void readOfflineStageReadCache(organizationId)
      .then((snapshot) => {
        if (cacheReadGenerationRef.current !== generation) return;
        setOfflineSnapshot(snapshot ? { organizationId, data: snapshot } : null);
      })
      .catch((error) => {
        if (cacheReadGenerationRef.current !== generation) return;
        logger.warn('[MusicDataProvider] Offline stage cache read failed.', error);
        setOfflineSnapshot(null);
      });

    return () => {
      if (cacheReadGenerationRef.current === generation) {
        cacheReadGenerationRef.current++;
      }
    };
  }, [effectiveOrganizationId]);

  // Persist only already-authorized, tenant-proven canonical read data. The
  // cache service removes member/role/audit actors and band assignments.
  useEffect(() => {
    const organizationId = effectiveOrganizationId;
    if (!organizationId || isOffline || musicData.loading || musicData.error) return;

    const songsAreScoped = musicData.songs.every(
      (song) => song.organizationId === organizationId,
    );
    const scalesAreScoped = musicData.populatedScales.every((scale) => {
      const scaleOrganizationId = (scale as PopulatedScale & { organizationId?: string }).organizationId;
      return (
        scaleOrganizationId === organizationId &&
        scale.songs.every((song) => song.organizationId === organizationId)
      );
    });

    if (!songsAreScoped || !scalesAreScoped) {
      logger.warn('[MusicDataProvider] Refusing to persist stage cache with mixed tenant data.');
      return;
    }

    const timer = window.setTimeout(() => {
      void writeOfflineStageReadCache(
        organizationId,
        musicData.songs,
        musicData.populatedScales,
      ).catch((error) => {
        logger.warn('[MusicDataProvider] Offline stage cache write failed.', error);
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    effectiveOrganizationId,
    isOffline,
    musicData.loading,
    musicData.error,
    musicData.songs,
    musicData.populatedScales,
  ]);

  // Once a fallback becomes necessary, keep it visible through the reconnect
  // refresh. It is released only after canonical data is healthy again.
  useEffect(() => {
    const hasScopedSnapshot = offlineSnapshot?.organizationId === effectiveOrganizationId;
    if (!hasScopedSnapshot) {
      setOfflineFallbackActive(false);
      return;
    }

    if (musicData.error || (isOffline && musicData.loading)) {
      setOfflineFallbackActive(true);
      return;
    }

    if (!musicData.loading && !musicData.error) {
      setOfflineFallbackActive(false);
    }
  }, [
    offlineSnapshot,
    effectiveOrganizationId,
    isOffline,
    musicData.loading,
    musicData.error,
  ]);

  // A reconnect revalidates against canonical Firestore data. Cached stage
  // content remains visible if it had already become the active fallback.
  useEffect(() => {
    const wasOffline = wasOfflineRef.current;
    wasOfflineRef.current = isOffline;

    if (wasOffline && !isOffline && effectiveOrganizationId) {
      void musicData.refreshData();
    }
  }, [isOffline, effectiveOrganizationId, musicData.refreshData]);

  useEffect(() => {
    if (!isOffline && !musicData.loading && !musicData.error) {
      setOfflineSnapshot(null);
    }
  }, [isOffline, musicData.loading, musicData.error]);

  const contextValue = useMemo<MusicDataContextType>(() => {
    const scopedOfflineData =
      offlineSnapshot?.organizationId === effectiveOrganizationId
        ? offlineSnapshot.data
        : null;

    if (!offlineFallbackActive || !scopedOfflineData) {
      return musicData;
    }

    return {
      ...musicData,
      songs: scopedOfflineData.songs,
      scales: scopedOfflineData.scales,
      populatedScales: scopedOfflineData.populatedScales,
      bandScales: [],
      populatedBandScales: [],
      eventTypes: scopedOfflineData.eventTypes,
      locations: scopedOfflineData.locations,
      eventNames: scopedOfflineData.eventNames,
      tags: scopedOfflineData.tags,
      roles: [],
      instruments: [],
      allUsers: [],
      usersStatus: 'error',
      fixedBandScales: [],
      loading: false,
      error: null,
    };
  }, [musicData, offlineSnapshot, effectiveOrganizationId, offlineFallbackActive]);

  return (
    <MusicDataContext.Provider value={contextValue}>
      {children}
    </MusicDataContext.Provider>
  );
};

export const useMusic = (): MusicDataContextType => {
  const context = useContext(MusicDataContext);
  if (context === undefined) {
    throw new Error('useMusic must be used within a MusicDataProvider');
  }
  return context;
};
