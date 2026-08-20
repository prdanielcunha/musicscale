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
import { readMusicDataCache } from '../lib/musicDataCache';
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
  userId: string;
  organizationId: string;
  data: OfflineStageReadSnapshot;
}

export const MusicDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const musicData = useMusicData();
  const { user, effectiveOrganizationId } = useAuth();
  const { isOffline } = useOffline();
  const userId = user?.uid;
  const [offlineSnapshot, setOfflineSnapshot] = useState<ScopedOfflineSnapshot | null>(null);
  const [offlineFallbackActive, setOfflineFallbackActive] = useState(false);
  const [reconnectPending, setReconnectPending] = useState(false);
  const cacheReadGenerationRef = useRef(0);
  const reconnectGenerationRef = useRef(0);
  const reconnectPendingRef = useRef(false);
  const wasOfflineRef = useRef(isOffline);
  const blockedByOnlineCanonicalErrorRef = useRef(false);

  // IndexedDB is a read fallback only. It never establishes user or tenant
  // authority: both scopes must already come from the canonical auth context.
  useEffect(() => {
    const generation = ++cacheReadGenerationRef.current;
    const organizationId = effectiveOrganizationId;

    reconnectGenerationRef.current++;
    reconnectPendingRef.current = false;
    setReconnectPending(false);
    setOfflineSnapshot(null);
    setOfflineFallbackActive(false);
    if (!userId || !organizationId) return;

    void readOfflineStageReadCache(userId, organizationId)
      .then((snapshot) => {
        if (cacheReadGenerationRef.current !== generation) return;
        setOfflineSnapshot(snapshot ? { userId, organizationId, data: snapshot } : null);
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
  }, [userId, effectiveOrganizationId]);

  // Persist only already-authorized, tenant-proven canonical read data. The
  // stage cache inherits the issuedAt of the canonical UID+tenant cache instead
  // of becoming artificially newer every time the provider mounts.
  useEffect(() => {
    const organizationId = effectiveOrganizationId;
    if (!userId || !organizationId || isOffline || musicData.loading || musicData.error) return;

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
      const sourceReadAt = Date.now();
      const sourceCache = readMusicDataCache<any>(
        window.localStorage,
        userId,
        organizationId,
        sourceReadAt,
      );

      if (
        (sourceCache.status !== 'fresh' && sourceCache.status !== 'stale') ||
        !sourceCache.data
      ) {
        return;
      }

      const sourceIssuedAt = sourceReadAt - sourceCache.ageMs;
      void writeOfflineStageReadCache(
        userId,
        organizationId,
        musicData.songs,
        musicData.populatedScales,
        sourceIssuedAt,
      ).catch((error) => {
        logger.warn('[MusicDataProvider] Offline stage cache write failed.', error);
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    userId,
    effectiveOrganizationId,
    isOffline,
    musicData.loading,
    musicData.error,
    musicData.songs,
    musicData.populatedScales,
  ]);

  // A canonical error observed while online may represent permission-denied or
  // another current authority failure. Going offline afterwards must never turn
  // that denial into cache-backed access. A healthy canonical read clears it.
  useEffect(() => {
    if (isOffline || musicData.loading) return;
    blockedByOnlineCanonicalErrorRef.current = !!musicData.error;
  }, [isOffline, musicData.loading, musicData.error]);

  // Reconnect is an explicit revalidation window. If stage fallback was already
  // active while offline, preserve it until refreshData settles. Scope changes
  // invalidate the generation so a late refresh cannot hold another context.
  useEffect(() => {
    const wasOffline = wasOfflineRef.current;
    wasOfflineRef.current = isOffline;

    if (isOffline) {
      reconnectGenerationRef.current++;
      reconnectPendingRef.current = false;
      setReconnectPending(false);
      return;
    }

    if (wasOffline && userId && effectiveOrganizationId) {
      const generation = ++reconnectGenerationRef.current;
      const preserveFallback = offlineFallbackActive;
      reconnectPendingRef.current = preserveFallback;
      setReconnectPending(preserveFallback);

      void musicData.refreshData().finally(() => {
        if (reconnectGenerationRef.current !== generation) return;
        reconnectPendingRef.current = false;
        setReconnectPending(false);
      });
    }
  }, [
    isOffline,
    userId,
    effectiveOrganizationId,
    musicData.refreshData,
    offlineFallbackActive,
  ]);

  // Once a fallback becomes necessary while genuinely offline, keep it visible
  // through the reconnect refresh. Release it as soon as canonical data is
  // healthy, or when an online refresh has settled with an error.
  useEffect(() => {
    const hasScopedSnapshot =
      offlineSnapshot?.userId === userId &&
      offlineSnapshot?.organizationId === effectiveOrganizationId;

    if (!hasScopedSnapshot) {
      setOfflineFallbackActive(false);
      return;
    }

    if (!musicData.loading && !musicData.error) {
      setOfflineFallbackActive(false);
      return;
    }

    if (isOffline) {
      setOfflineFallbackActive(!blockedByOnlineCanonicalErrorRef.current);
      return;
    }

    if (reconnectPendingRef.current || reconnectPending) {
      return;
    }

    if (!musicData.loading) {
      setOfflineFallbackActive(false);
    }
  }, [
    offlineSnapshot,
    userId,
    effectiveOrganizationId,
    isOffline,
    reconnectPending,
    musicData.loading,
    musicData.error,
  ]);

  useEffect(() => {
    if (
      !isOffline &&
      !musicData.loading &&
      !reconnectPendingRef.current &&
      !reconnectPending
    ) {
      if (!musicData.error) {
        setOfflineSnapshot(null);
      }
      setOfflineFallbackActive(false);
    }
  }, [isOffline, reconnectPending, musicData.loading, musicData.error]);

  const contextValue = useMemo<MusicDataContextType>(() => {
    const scopedOfflineData =
      offlineSnapshot?.userId === userId &&
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
  }, [
    musicData,
    offlineSnapshot,
    userId,
    effectiveOrganizationId,
    offlineFallbackActive,
  ]);

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
