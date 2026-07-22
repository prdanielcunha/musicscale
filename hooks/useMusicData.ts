import { markStartupMetric, markStartupFailure, recordStartupGauge } from '../lib/startupTelemetry';
import { logger } from '../lib/logger';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Song, Scale, EventType, Location, PopulatedScale, EventName, Tag, PopulatedSong, Role, Instrument, BandScale, PopulatedBandScale, UserProfile, FixedBandScale } from '../types';
import { applyScaleSongSettings } from '../utils/scaleSongSettings';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../contexts/ApiContext';

import { scaleRetentionService } from '../services/offline/ScaleRetentionService';
import { readMusicDataCache, writeMusicDataCache } from '../lib/musicDataCache';

export const useMusicData = () => {
  const { user, effectiveOrganizationId } = useAuth();
  const api = useApi();
  const generationRef = useRef(0);
  const watchdogRef = useRef<NodeJS.Timeout | null>(null);
  
  const activeContextKeyRef = useRef<string | null>(null);
  const isOperationalRef = useRef<boolean>(false);

  const [songs, setSongs] = useState<PopulatedSong[]>([]);
  const [scales, setScales] = useState<Scale[]>([]);
  const [populatedScales, setPopulatedScales] = useState<PopulatedScale[]>([]);
  const [bandScales, setBandScales] = useState<BandScale[]>([]);
  const [populatedBandScales, setPopulatedBandScales] = useState<PopulatedBandScale[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [eventNames, setEventNames] = useState<EventName[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [fixedBandScales, setFixedBandScales] = useState<FixedBandScale[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearData = useCallback(() => {
    setSongs([]);
    setScales([]);
    setPopulatedScales([]);
    setBandScales([]);
    setPopulatedBandScales([]);
    setEventTypes([]);
    setLocations([]);
    setEventNames([]);
    setTags([]);
    setRoles([]);
    setInstruments([]);
    setAllUsers([]);
    setFixedBandScales([]);
  }, []);

  const fetchData = useCallback(async () => {
    if (!api || !user || !effectiveOrganizationId) {
      logger.debug("[useMusicData] Missing api or orgId, skipping fetch");
      setLoading(false);
      return;
    }

    const currentGeneration = ++generationRef.current;
    const uid = user.uid;
    const orgId = effectiveOrganizationId;
    const currentContextKey = `${uid}:${orgId}`;
    
    const isContextChange = activeContextKeyRef.current !== currentContextKey;
    
    if (isContextChange) {
       activeContextKeyRef.current = currentContextKey;
       isOperationalRef.current = false;
       clearData();
       setError(null);
    }
    
    // Clear legacy cache if any
    localStorage.removeItem(`musicDataCache_${orgId}`);

    // Read new cache
    const cacheResult = readMusicDataCache<any>(localStorage, uid, orgId);
    let hasUsableCache = false;

    recordStartupGauge('cache_hit', !!cacheResult.data ? 1 : 0, {
      cache_hit: !!cacheResult.data,
      cache_status: cacheResult.status
    });

    if (!!cacheResult.data && (cacheResult.status === 'fresh' || cacheResult.status === 'stale')) {
        recordStartupGauge('cache_age_ms', cacheResult.ageMs, { cache_age_ms: cacheResult.ageMs });
    }
    
    if (cacheResult.status === 'invalid') {
        markStartupFailure('cache_invalid');
    }

    if (cacheResult.status === 'fresh' || cacheResult.status === 'stale') {
      const data = cacheResult.data;
      if (data) {
        hasUsableCache = true;
        setSongs(data.songs || []);
        setScales(data.scales || []);
        setBandScales(data.bandScales || []);
        setEventTypes(data.eventTypes || []);
        setLocations(data.locations || []);
        setEventNames(data.eventNames || []);
        setTags(data.tags || []);
        setRoles(data.roles || []);
        setInstruments(data.instruments || []);
        setAllUsers(data.allUsers || []);
        setFixedBandScales(data.fixedBandScales || []);
        setPopulatedScales(data.populatedScales || []);
        setPopulatedBandScales(data.populatedBandScales || []);
        
        isOperationalRef.current = true;
        setLoading(false);
        setError(null);
        logger.debug(`[useMusicData] Restored from safe cache (status: ${cacheResult.status})`);
        
        markStartupMetric('cached_shell_rendered_ms');
        markStartupMetric('first_operational_screen_ms');
      }
    }

    if (!isOperationalRef.current) {
      setLoading(true);
    }

    // Clear previous watchdog
    if (watchdogRef.current) clearTimeout(watchdogRef.current);

    // Watchdog of 8 seconds
    watchdogRef.current = setTimeout(() => {
      if (generationRef.current === currentGeneration && !hasUsableCache && !isOperationalRef.current) {
        setLoading(false);
        setError('O servidor demorou muito para responder (Timeout).');
        logger.warn('[useMusicData] Data fetch timeout reached.');
        markStartupFailure('critical_data_timeout');
      }
    }, 8000);

    const wrap = async (name: string, p: Promise<any>) => {
        try {
            const res = await p;
            if (!Array.isArray(res)) throw new Error(`Result is not an array`);
            return { name, data: res };
        } catch (e: any) {
            const err = new Error(name); // preserve queryName securely in the Error message itself
            throw err;
        }
    };

    markStartupMetric('initial_data_started_ms');
    // Start all requests in parallel
    const criticalPromises = [
      wrap('songs', api.songs.list()),
      wrap('scales', api.scales.list()),
      wrap('bandScales', api.bandScales.list()),
      wrap('eventTypes', api.eventTypes.list()),
      wrap('locations', api.locations.list()),
      wrap('eventNames', api.eventNames.list()),
      wrap('tags', api.tags.list())
    ];
    
    const secondaryPromises = [
      wrap('roles', api.roles.list()),
      wrap('instruments', api.instruments.list()),
      wrap('users', api.users.list()),
      wrap('fixedBandScales', api.fixedBandScales.list())
    ];

    const criticalBatch = Promise.allSettled(criticalPromises);
    const secondaryBatch = Promise.allSettled(secondaryPromises);

    try {
      // Critical wave
      const criticalResults = await criticalBatch;
      
      if (generationRef.current !== currentGeneration) return;

      const failedCritical = criticalResults.filter(r => r.status === 'rejected');
      if (failedCritical.length > 0) {
          if (watchdogRef.current) clearTimeout(watchdogRef.current);
          const failedNames = failedCritical.map((r: any) => r.reason?.message || 'unknown');
          logger.warn(`[useMusicData] Critical batch failed for: ${failedNames.join(', ')}`);
          markStartupFailure('critical_data_failed');
          if (!hasUsableCache) {
             setLoading(false);
             setError('Falha ao carregar dados críticos.');
          }
          return; // stop here, don't overwrite cache, don't proceed to secondary
      }

      const getCriticalData = (name: string) => {
         const res = criticalResults.find((r: any) => r.status === 'fulfilled' && r.value.name === name) as PromiseFulfilledResult<any>;
         return res.value.data;
      };

      const songsData = getCriticalData('songs');
      const scalesData = getCriticalData('scales');
      const bandScalesData = getCriticalData('bandScales');
      const eventTypesData = getCriticalData('eventTypes');
      const locationsData = getCriticalData('locations');
      const eventNamesData = getCriticalData('eventNames');
      const tagsData = getCriticalData('tags');

      const populatedSongs = songsData.map((song: any): PopulatedSong => ({
        ...song,
        lastPlayed: song.lastPlayed || null,
        tags: (song.tagIds || []).map((id: string) => tagsData.find((t: any) => t.id === id)).filter((t: any): t is Tag => !!t),
      }));

      let initialPopulatedBandScalesResult: PopulatedBandScale[] = [];
      let initialPopulatedScalesResult: PopulatedScale[] = [];

      if (!hasUsableCache) {
          // Build initial PopulatedBandScales without users/instruments
          initialPopulatedBandScalesResult = bandScalesData.map((bs: any): PopulatedBandScale | null => {
            const eventType = eventTypesData.find((et: any) => et.id === bs.eventTypeId);
            const location = locationsData.find((l: any) => l.id === bs.locationId);
            if (!eventType || !location) return null;
            
            return {
              ...bs,
              eventType,
              location,
              eventName: eventNamesData.find((en: any) => en.id === bs.eventNameId),
              assignments: [], // Empty for now, will be filled in secondary wave
            };
          }).filter((ps: any): ps is PopulatedBandScale => !!ps);

          initialPopulatedScalesResult = scalesData
            .map((scale: any): PopulatedScale | null => {
                const scaleSongs = (scale.songIds || []).map((id: string) => {
                  const s = populatedSongs.find((s: any) => s.id === id);
                  if (!s) return null;
                  return applyScaleSongSettings(s, scale.songSettings?.[id]);
                }).filter((s: any): s is PopulatedSong => !!s);
                const eventType = eventTypesData.find((et: any) => et.id === scale.eventTypeId);
                const location = locationsData.find((l: any) => l.id === scale.locationId);
                if (!eventType || !location) return null;
                
                return {
                    ...scale,
                    songs: scaleSongs,
                    eventType: eventType,
                    eventName: eventNamesData.find((en: any) => en.id === scale.eventNameId),
                    location: location,
                    bandScale: initialPopulatedBandScalesResult.find((bs: any) => bs.id === scale.bandScaleId) || undefined
                };
            })
            .filter((ps: any): ps is PopulatedScale => !!ps)
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }

      setSongs(populatedSongs);
      setScales(scalesData);
      setBandScales(bandScalesData);
      setEventTypes(eventTypesData);
      setLocations(locationsData);
      setEventNames(eventNamesData);
      setTags(tagsData);
      
      if (!hasUsableCache) {
          setPopulatedScales(initialPopulatedScalesResult);
          setPopulatedBandScales(initialPopulatedBandScalesResult);
      }

      isOperationalRef.current = true;
      setLoading(false);
      setError(null); // Clear potential timeout error
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      markStartupMetric('first_operational_screen_ms');

      // Async background retention cleanup
      setTimeout(() => {
          scaleRetentionService.runRetentionCleanup(orgId).catch(e => {
             logger.warn('Initial retention cleanup encountered an error:', e);
          });
      }, 5000);

      // Secondary wave
      const secondaryResults = await secondaryBatch;

      if (generationRef.current !== currentGeneration) return;

      const failedSecondary = secondaryResults.filter(r => r.status === 'rejected');
      if (failedSecondary.length > 0) {
          const failedNames = failedSecondary.map((r: any) => r.reason?.message || 'unknown');
          logger.warn(`[useMusicData] Secondary batch failed for: ${failedNames.join(', ')}`);
          markStartupFailure('secondary_data_failed');
          return; // stop here, don't overwrite cache, don't replace with empty arrays
      }

      const getSecondaryData = (name: string) => {
         const res = secondaryResults.find((r: any) => r.status === 'fulfilled' && r.value.name === name) as PromiseFulfilledResult<any>;
         return res.value.data;
      };

      const rolesData = getSecondaryData('roles');
      const instrumentsData = getSecondaryData('instruments');
      const allUsersData = getSecondaryData('users');
      const fixedBandScalesData = getSecondaryData('fixedBandScales');

      const roleUserCounts = new Map<string, number>();
      allUsersData.forEach((u: any) => {
          if (u.roleId) {
              roleUserCounts.set(u.roleId, (roleUserCounts.get(u.roleId) || 0) + 1);
          }
      });

      const musicAppStandardRoles = ['Administrador', 'Líder', 'Ministro', 'Músico', 'Vocal', 'Visitante'];
      const otherAppsKeywords = ['mesa', 'cuidado', 'presença', 'presenca', 'primeiros passos'];

      const isMusicAppRole = (role: Role) => {
          const name = role.name.toLowerCase();
          const desc = (role.description || '').toLowerCase();
          const hasUsers = (roleUserCounts.get(role.id) || 0) > 0;
             
          if (musicAppStandardRoles.some(standard => role.name.includes(standard))) return true;
          if (hasUsers) return true;
          const isOtherApp = otherAppsKeywords.some(kw => name.includes(kw) || desc.includes(kw));
          if (isOtherApp) return false;
          return true;
      };

      const filteredRoles = rolesData.filter((role: any) => 
        role.organizationId === orgId && isMusicAppRole(role)
      );
      const uniqueRolesMap = new Map<string, Role>();
      filteredRoles.forEach((role: any) => {
          if (!uniqueRolesMap.has(role.name)) {
              uniqueRolesMap.set(role.name, role);
          }
      });

      const standardInjects: Role[] = [
        { id: 'role_dummy_owner', organizationId: orgId, name: 'Dono', description: 'Acesso total.', permissions: { canManageUsers: true, canManageRoles: true, canManageRepertoire: true, canManageScales: true, canManageChords: true, canViewContent: true }, createdAt: new Date().toISOString() },
        { id: 'role_dummy_admin', organizationId: orgId, name: 'Administrador', description: 'Acesso total à plataforma e membros.', permissions: { canManageUsers: true, canManageRoles: true, canManageRepertoire: true, canManageScales: true, canManageChords: true, canViewContent: true }, createdAt: new Date().toISOString() },
        { id: 'role_dummy_leader', organizationId: orgId, name: 'Líder / Ministro', description: 'Pode gerenciar repertório e escalas.', permissions: { canManageUsers: false, canManageRoles: false, canManageRepertoire: true, canManageScales: true, canManageChords: true, canViewContent: true }, createdAt: new Date().toISOString() },
        { id: 'role_dummy_musician', organizationId: orgId, name: 'Músico / Vocal', description: 'Acesso ao repertório e escalas.', permissions: { canManageUsers: false, canManageRoles: false, canManageRepertoire: false, canManageScales: false, canManageChords: true, canViewContent: true }, createdAt: new Date().toISOString() },
        { id: 'role_dummy_visitor', organizationId: orgId, name: 'Visitante', description: 'Apenas visualização do acervo.', permissions: { canManageUsers: false, canManageRoles: false, canManageRepertoire: false, canManageScales: false, canManageChords: false, canViewContent: true }, createdAt: new Date().toISOString() },
      ];

      standardInjects.forEach(dr => {
          let found = false;
          uniqueRolesMap.forEach(r => {
             const rName = r.name.toLowerCase();
             const dName = dr.name.toLowerCase();
             if (rName === dName || rName.includes('dono') && dName.includes('dono')) found = true;
             else if (rName.includes('admin') && dName.includes('admin')) found = true;
             else if ((rName.includes('líder') || rName.includes('ministro')) && dName.includes('líder')) found = true;
             else if ((rName.includes('músico') || rName.includes('vocal')) && dName.includes('músico')) found = true;
             else if (rName.includes('visitante') && dName.includes('visitante')) found = true;
          });
          if (!found) {
             uniqueRolesMap.set(dr.name, dr);
             api.roles.create(dr).catch(()=>{});
          }
      });

      const allRolesArray = Array.from(uniqueRolesMap.values());
      setRoles(allRolesArray);
      
      const getRoleKeyFromName = (roleName: string): string => {
        const name = (roleName || "").toLowerCase();
        if (name.includes("dono") || name === "owner" || name === "ceo" || name.includes("founder")) return "owner";
        if (name.includes("administrador") || name === "admin") return "admin";
        if (name.includes("líder") || name.includes("lider") || name.includes("ministro") || name === "leader") return "leader";
        if (name.includes("músico") || name.includes("musico") || name.includes("vocal") || name === "musician") return "musician";
        return "viewer";
      };

      const normalizedUsers = allUsersData.map((u: any) => {
          const roleSourceStr = u.musicscaleRole || u.ministryFunction || u.organizationRole || u.roleId || u.role || 'viewer';
          
          let match = allRolesArray.find(r => r.id === roleSourceStr);
          if (!match) {
             const mappedKey = getRoleKeyFromName(roleSourceStr || "");
             if (mappedKey === 'owner') match = allRolesArray.find(r => r.name.includes('Dono'));
             else if (mappedKey === 'admin') match = allRolesArray.find(r => r.name.includes('Admin'));
             else if (mappedKey === 'leader') match = allRolesArray.find(r => r.name.includes('Líder') || r.name.includes('Ministro'));
             else if (mappedKey === 'musician') match = allRolesArray.find(r => r.name.includes('Músico') || r.name.includes('Vocal'));
             else match = allRolesArray.find(r => r.name.includes('Visitante'));
          }
          
          let resolvedRoleId = match ? match.id : u.roleId;
          return { ...u, roleId: resolvedRoleId };
      });
      setAllUsers(normalizedUsers);
      setInstruments(instrumentsData);
      setFixedBandScales(fixedBandScalesData);

      // Rebuild arrays with full data
      const finalPopulatedBandScalesResult = bandScalesData.map((bs: any): PopulatedBandScale | null => {
        const eventType = eventTypesData.find((et: any) => et.id === bs.eventTypeId);
        const location = locationsData.find((l: any) => l.id === bs.locationId);
        if (!eventType || !location) return null;
        
        const assignments = (bs.assignments || []).map((a: any) => {
            const user = normalizedUsers.find((u: any) => u.uid === a.userId);
            const instrument = instrumentsData.find((i: any) => i.id === a.instrumentId);
            return (user && instrument) ? { user, instrument } : null;
        }).filter(Boolean) as { user: UserProfile, instrument: Instrument }[];

        return {
          ...bs,
          eventType,
          location,
          eventName: eventNamesData.find((en: any) => en.id === bs.eventNameId),
          assignments,
        };
      }).filter((ps: any): ps is PopulatedBandScale => !!ps);

      const finalPopulatedScalesResult = scalesData
        .map((scale: any): PopulatedScale | null => {
            const scaleSongs = (scale.songIds || []).map((id: string) => {
              const s = populatedSongs.find((s: any) => s.id === id);
              if (!s) return null;
              return applyScaleSongSettings(s, scale.songSettings?.[id]);
            }).filter((s: any): s is PopulatedSong => !!s);
            const eventType = eventTypesData.find((et: any) => et.id === scale.eventTypeId);
            const location = locationsData.find((l: any) => l.id === scale.locationId);
            if (!eventType || !location) return null;
            
            return {
                ...scale,
                songs: scaleSongs,
                eventType: eventType,
                eventName: eventNamesData.find((en: any) => en.id === scale.eventNameId),
                location: location,
                bandScale: finalPopulatedBandScalesResult.find((bs: any) => bs.id === scale.bandScaleId) || undefined
            };
        })
        .filter((ps: any): ps is PopulatedScale => !!ps)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setPopulatedBandScales(finalPopulatedBandScalesResult);
      setPopulatedScales(finalPopulatedScalesResult);

      markStartupMetric('initial_data_completed_ms');
      // Write cache
      writeMusicDataCache(localStorage, uid, orgId, {
        songs: populatedSongs,
        scales: scalesData,
        bandScales: bandScalesData,
        eventTypes: eventTypesData,
        locations: locationsData,
        eventNames: eventNamesData,
        tags: tagsData,
        roles: allRolesArray,
        instruments: instrumentsData,
        allUsers: normalizedUsers,
        fixedBandScales: fixedBandScalesData,
        populatedScales: finalPopulatedScalesResult,
        populatedBandScales: finalPopulatedBandScalesResult,
      });

    } catch (err) {
      if (generationRef.current !== currentGeneration) return;
      if (!isOperationalRef.current) {
        setError('Failed to fetch data from Firestore.');
        setLoading(false);
      }
      logger.warn('Failed to fetch data from Firestore.', err);
    }
  }, [user, effectiveOrganizationId, api, clearData]);

  useEffect(() => {
    if (user && effectiveOrganizationId) {
      fetchData();
    } else {
      generationRef.current++;
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      activeContextKeyRef.current = null;
      isOperationalRef.current = false;
      clearData();
      setLoading(false);
    }
    return () => {
       generationRef.current++; // invalidate current generation
       if (watchdogRef.current) clearTimeout(watchdogRef.current);
    }
  }, [user, effectiveOrganizationId, fetchData, clearData]);
  
  const refreshDataWithUser = useCallback(async () => {
    if (user && effectiveOrganizationId) {
        await fetchData();
    }
  }, [user, effectiveOrganizationId, fetchData]);

  return useMemo(() => ({
    songs,
    scales,
    populatedScales,
    bandScales,
    populatedBandScales,
    eventTypes,
    locations,
    eventNames,
    tags,
    roles,
    instruments,
    allUsers,
    fixedBandScales,
    loading,
    error,
    refreshData: refreshDataWithUser,
  }), [
    songs, scales, populatedScales, bandScales, populatedBandScales,
    eventTypes, locations, eventNames, tags, roles, instruments,
    allUsers, fixedBandScales, loading, error, refreshDataWithUser
  ]);
};
