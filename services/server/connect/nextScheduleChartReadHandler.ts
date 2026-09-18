import crypto from 'crypto';
import { resolveOrganizationAuthorization } from '../organizationAuthorization.js';
import { buildEffectiveAccessContext, hasMusicScaleCapability } from '../../../utils/rbac.js';
import {
  areKeysEnharmonicallyEquivalent,
  isValidKey,
  resolveChordContentSourceKey,
  transposeChordDocument,
  validateTransposedPreview,
} from '../../../utils/chordEngine.js';
import {
  ConnectBandScaleRecord,
  ConnectScaleRecord,
  selectNextAssignedSchedule,
} from './nextScheduleSelector.js';

type MinimalRequest = {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
};

type MinimalResponse = {
  status(code: number): MinimalResponse;
  json(payload: unknown): unknown;
  setHeader?(name: string, value: string): void;
};

export interface ConnectChartSongRecord {
  id: string;
  organizationId?: string | null;
  title?: string | null;
  artist?: string | null;
  key?: string | null;
  originalKey?: string | null;
  selectedKey?: string | null;
  bpm?: number | null;
  chords?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ConnectNextScheduleChartDependencies {
  db: any;
  auth: any;
  now?: () => number;
  resolveAuthorization?: typeof resolveOrganizationAuthorization;
  loadTenantSnapshot?: (
    organizationId: string,
    db: any,
  ) => Promise<{ scales: ConnectScaleRecord[]; bandScales: ConnectBandScaleRecord[] }>;
  loadSongs?: (
    organizationId: string,
    songIds: string[],
    db: any,
  ) => Promise<ConnectChartSongRecord[]>;
  logger?: {
    info?: (message: string, meta?: unknown) => void;
    warn?: (message: string, meta?: unknown) => void;
    error?: (message: string, meta?: unknown) => void;
  };
}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() || '';
  return typeof value === 'string' ? value.trim() : '';
}

function getHeader(req: MinimalRequest, name: string): string {
  const direct = req.headers[name];
  if (direct !== undefined) return headerValue(direct);
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLowerCase() === lowerName) return headerValue(value);
  }
  return '';
}

function resolveBearerHeader(req: MinimalRequest):
  | { ok: true; value: string }
  | { ok: false; code: 'UNAUTHORIZED' } {
  const standard = getHeader(req, 'authorization');
  const forwarded = getHeader(req, 'x-connect-user-authorization');
  const value = forwarded || standard;
  if (!value || !/^Bearer\s+\S+/i.test(value)) return { ok: false, code: 'UNAUTHORIZED' };
  return { ok: true, value };
}

function queryText(req: MinimalRequest, key: string, maxLength: number): string {
  const value = req.query?.[key];
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLength);
}

function normalizeLocale(value: string): 'pt-BR' | 'en' | 'es' {
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('es')) return 'es';
  return 'pt-BR';
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function safeText(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function safeBpm(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 20 && value <= 300
    ? value
    : null;
}

function maskUid(uid: string): string {
  if (uid.length <= 6) return '***';
  return `${uid.slice(0, 3)}***${uid.slice(-3)}`;
}

function uniqueSongIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || id.length > 256 || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= 100) break;
  }
  return result;
}

async function loadTenantSnapshotFromFirestore(
  organizationId: string,
  db: any,
): Promise<{ scales: ConnectScaleRecord[]; bandScales: ConnectBandScaleRecord[] }> {
  const [scaleSnap, bandScaleSnap] = await Promise.all([
    db.collection('scales').where('organizationId', '==', organizationId).get(),
    db.collection('bandScales').where('organizationId', '==', organizationId).get(),
  ]);
  return {
    scales: scaleSnap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
    bandScales: bandScaleSnap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
  };
}

async function loadSongsFromFirestore(
  organizationId: string,
  songIds: string[],
  db: any,
): Promise<ConnectChartSongRecord[]> {
  const docs = await Promise.all(
    songIds.map(async (songId) => {
      const snapshot = await db.collection('songs').doc(songId).get();
      if (!snapshot.exists) return null;
      const data = snapshot.data() || {};
      if (data.organizationId !== organizationId) return null;
      return { id: snapshot.id, ...data } as ConnectChartSongRecord;
    }),
  );
  return docs.filter((song): song is ConnectChartSongRecord => Boolean(song));
}

function chooseSong(
  songs: ConnectChartSongRecord[],
  songId: string,
  titleQuery: string,
):
  | { status: 'resolved'; song: ConnectChartSongRecord }
  | { status: 'not_found' }
  | { status: 'ambiguous'; options: Array<{ id: string; title: string; artist: string | null }> } {
  if (songId) {
    const found = songs.find((song) => song.id === songId);
    return found ? { status: 'resolved', song: found } : { status: 'not_found' };
  }

  const normalized = normalizeSearch(titleQuery);
  if (!normalized) return { status: 'not_found' };

  const exact = songs.filter((song) => normalizeSearch(safeText(song.title, 180)) === normalized);
  if (exact.length === 1) return { status: 'resolved', song: exact[0] };
  if (exact.length > 1) {
    return {
      status: 'ambiguous',
      options: exact.slice(0, 10).map((song) => ({
        id: song.id,
        title: safeText(song.title, 180) || 'Sem título',
        artist: safeText(song.artist, 160) || null,
      })),
    };
  }

  const contains = songs.filter((song) => {
    const title = normalizeSearch(safeText(song.title, 180));
    const artist = normalizeSearch(safeText(song.artist, 160));
    return title.includes(normalized) || artist.includes(normalized);
  });
  if (contains.length === 1) return { status: 'resolved', song: contains[0] };
  if (contains.length > 1) {
    return {
      status: 'ambiguous',
      options: contains.slice(0, 10).map((song) => ({
        id: song.id,
        title: safeText(song.title, 180) || 'Sem título',
        artist: safeText(song.artist, 160) || null,
      })),
    };
  }
  return { status: 'not_found' };
}

function localize(
  locale: 'pt-BR' | 'en' | 'es',
  key: 'no_schedule' | 'not_found' | 'no_chords' | 'source_unverified' | 'transpose_failed',
  title?: string,
): string {
  const name = title || '';
  const messages = {
    'pt-BR': {
      no_schedule: 'Não encontrei uma próxima escala atribuída a você.',
      not_found: 'Não encontrei essa música no repertório da sua próxima escala.',
      no_chords: `${name || 'Essa música'} ainda não possui cifra cadastrada.`,
      source_unverified: `A cifra de ${name || 'essa música'} existe, mas o tom de origem ainda precisa ser confirmado no MusicScale antes de eu entregá-la no tom da escala.`,
      transpose_failed: `Não consegui validar com segurança a transposição da cifra de ${name || 'essa música'}.`,
    },
    en: {
      no_schedule: 'I could not find an upcoming schedule assigned to you.',
      not_found: 'I could not find that song in your next schedule repertoire.',
      no_chords: `${name || 'This song'} does not have a chart yet.`,
      source_unverified: `The chart for ${name || 'this song'} exists, but its source key must be confirmed in MusicScale before I deliver it in the scheduled key.`,
      transpose_failed: `I could not safely validate the chart transposition for ${name || 'this song'}.`,
    },
    es: {
      no_schedule: 'No encontré una próxima escala asignada a ti.',
      not_found: 'No encontré esa canción en el repertorio de tu próxima escala.',
      no_chords: `${name || 'Esta canción'} todavía no tiene cifra registrada.`,
      source_unverified: `La cifra de ${name || 'esta canción'} existe, pero el tono de origen debe confirmarse en MusicScale antes de entregarla en el tono programado.`,
      transpose_failed: `No pude validar de forma segura la transposición de la cifra de ${name || 'esta canción'}.`,
    },
  } as const;
  return messages[locale][key];
}

function successSummary(
  locale: 'pt-BR' | 'en' | 'es',
  title: string,
  targetKey: string,
  transposed: boolean,
): string {
  if (locale === 'en') {
    return transposed
      ? `Here is the chart for ${title} in the scheduled key (${targetKey}).`
      : `Here is the chart for ${title} in ${targetKey}.`;
  }
  if (locale === 'es') {
    return transposed
      ? `Aquí está la cifra de ${title} en el tono programado (${targetKey}).`
      : `Aquí está la cifra de ${title} en ${targetKey}.`;
  }
  return transposed
    ? `Aqui está a cifra de ${title} no tom programado da escala (${targetKey}).`
    : `Aqui está a cifra de ${title} em ${targetKey}.`;
}

export function createConnectNextScheduleChartReadHandler(
  deps: ConnectNextScheduleChartDependencies,
) {
  const resolveAuthorization = deps.resolveAuthorization ?? resolveOrganizationAuthorization;
  const loadTenantSnapshot = deps.loadTenantSnapshot ?? loadTenantSnapshotFromFirestore;
  const loadSongs = deps.loadSongs ?? loadSongsFromFirestore;
  const now = deps.now ?? Date.now;
  const logger = deps.logger ?? console;

  return async function handleConnectNextScheduleChartRead(req: MinimalRequest, res: MinimalResponse) {
    const auditId = `ms-chart-${crypto.randomUUID()}`;
    res.setHeader?.('Cache-Control', 'no-store');

    const bearerResolution = resolveBearerHeader(req);
    const organizationId = getHeader(req, 'x-organization-id');
    const channel = getHeader(req, 'x-connect-channel').toLowerCase();
    const locale = normalizeLocale(getHeader(req, 'accept-language'));
    const songId = queryText(req, 'songId', 256);
    const titleQuery = queryText(req, 'title', 180);

    if (bearerResolution.ok === false) {
      return res.status(401).json({ success: false, code: bearerResolution.code, auditId, humanSummary: 'Authentication required.' });
    }
    if (!organizationId) {
      return res.status(400).json({ success: false, code: 'ORGANIZATION_REQUIRED', auditId, humanSummary: 'Organization context is required.' });
    }
    if (channel !== 'inapp') {
      return res.status(403).json({
        success: false,
        code: 'CHANNEL_NOT_ALLOWED',
        auditId,
        humanSummary: 'Chart delivery is currently restricted to the authenticated in-app surface.',
      });
    }
    if (!songId && !titleQuery) {
      return res.status(400).json({ success: false, code: 'SONG_REQUIRED', auditId, humanSummary: 'Song context is required.' });
    }

    try {
      const authorization = await resolveAuthorization(
        bearerResolution.value,
        organizationId,
        deps.db,
        deps.auth,
        { checkRevoked: false },
      );
      if (authorization.error || !authorization.context) {
        const status = authorization.statusCode || 403;
        return res.status(status).json({
          success: false,
          code: authorization.error || 'FORBIDDEN',
          auditId,
          humanSummary: status === 401 ? 'Authentication required.' : 'Access denied.',
        });
      }

      const authContext = authorization.context;
      const effectiveOrganizationRole = authContext.isOwner ? 'owner' : authContext.organizationRole || null;
      const access = buildEffectiveAccessContext(
        authContext.uid,
        organizationId,
        authContext.systemRole,
        effectiveOrganizationRole,
        authContext.isActive ? 'active' : 'inactive',
      );

      if (
        (!authContext.isActive && !access.isGlobalFullAccess) ||
        !hasMusicScaleCapability(access, 'scales.read') ||
        !hasMusicScaleCapability(access, 'songs.read')
      ) {
        return res.status(403).json({ success: false, code: 'PERMISSION_DENIED', auditId, humanSummary: 'Access denied.' });
      }

      const snapshot = await loadTenantSnapshot(organizationId, deps.db);
      const selection = selectNextAssignedSchedule({
        organizationId,
        actorUid: authContext.uid,
        scales: snapshot.scales,
        bandScales: snapshot.bandScales,
        nowMs: now(),
      });

      if (!selection) {
        return res.status(200).json({
          success: true,
          protocolVersion: '1.0.0',
          auditId,
          organizationId,
          schedule: null,
          chart: null,
          humanSummary: localize(locale, 'no_schedule'),
        });
      }

      const scheduledSongIds = uniqueSongIds(selection.scale.songIds);
      const songs = scheduledSongIds.length > 0
        ? await loadSongs(organizationId, scheduledSongIds, deps.db)
        : [];
      const resolution = chooseSong(songs, songId, titleQuery);

      if (resolution.status === 'not_found') {
        return res.status(404).json({
          success: false,
          code: 'SONG_NOT_FOUND',
          auditId,
          humanSummary: localize(locale, 'not_found'),
        });
      }
      if (resolution.status === 'ambiguous') {
        return res.status(409).json({
          success: false,
          code: 'AMBIGUOUS_SONG',
          auditId,
          options: resolution.options,
          humanSummary: locale === 'en'
            ? 'I found more than one matching song in your next schedule.'
            : locale === 'es'
              ? 'Encontré más de una canción coincidente en tu próxima escala.'
              : 'Encontrei mais de uma música correspondente na sua próxima escala.',
        });
      }

      const song = resolution.song;
      const title = safeText(song.title, 180) || 'Sem título';
      const chords = typeof song.chords === 'string' ? song.chords.trim() : '';
      const scheduleSettings = selection.scale.songSettings?.[song.id];
      const requestedTargetKey =
        safeText(scheduleSettings?.key, 24) ||
        safeText(song.key, 24) ||
        safeText(song.selectedKey, 24) ||
        safeText(song.originalKey, 24);

      if (!chords) {
        return res.status(200).json({
          success: true,
          protocolVersion: '1.0.0',
          auditId,
          organizationId,
          schedule: {
            id: selection.scale.id,
            organizationId,
            deepLink: `/scales/${encodeURIComponent(selection.scale.id)}`,
          },
          chart: {
            status: 'no_chords',
            songId: song.id,
            title,
            artist: safeText(song.artist, 160) || null,
          },
          humanSummary: localize(locale, 'no_chords', title),
        });
      }

      const sourceResolution = resolveChordContentSourceKey(song.metadata as any);
      if (!sourceResolution?.canAutoConfirm || !isValidKey(sourceResolution.key)) {
        return res.status(200).json({
          success: true,
          protocolVersion: '1.0.0',
          auditId,
          organizationId,
          schedule: {
            id: selection.scale.id,
            organizationId,
            deepLink: `/scales/${encodeURIComponent(selection.scale.id)}`,
          },
          chart: {
            status: 'requires_source_key_confirmation',
            songId: song.id,
            title,
            artist: safeText(song.artist, 160) || null,
            scheduledKey: requestedTargetKey || null,
          },
          humanSummary: localize(locale, 'source_unverified', title),
        });
      }

      const sourceKey = sourceResolution.key;
      const targetKey = requestedTargetKey && isValidKey(requestedTargetKey)
        ? requestedTargetKey
        : sourceKey;

      let finalChords = chords;
      let transposed = false;
      let changedChordCount = 0;

      if (!areKeysEnharmonicallyEquivalent(sourceKey, targetKey)) {
        try {
          const result = transposeChordDocument(chords, sourceKey, targetKey);
          const validation = validateTransposedPreview(chords, result.chords, sourceKey, targetKey);
          if (!validation.valid) {
            return res.status(200).json({
              success: true,
              protocolVersion: '1.0.0',
              auditId,
              organizationId,
              schedule: {
                id: selection.scale.id,
                organizationId,
                deepLink: `/scales/${encodeURIComponent(selection.scale.id)}`,
              },
              chart: {
                status: 'transposition_failed',
                songId: song.id,
                title,
                artist: safeText(song.artist, 160) || null,
                sourceKey,
                scheduledKey: targetKey,
              },
              humanSummary: localize(locale, 'transpose_failed', title),
            });
          }
          finalChords = result.chords;
          transposed = result.semitones !== 0;
          changedChordCount = result.changedChordCount;
        } catch {
          return res.status(200).json({
            success: true,
            protocolVersion: '1.0.0',
            auditId,
            organizationId,
            schedule: {
              id: selection.scale.id,
              organizationId,
              deepLink: `/scales/${encodeURIComponent(selection.scale.id)}`,
            },
            chart: {
              status: 'transposition_failed',
              songId: song.id,
              title,
              artist: safeText(song.artist, 160) || null,
              sourceKey,
              scheduledKey: targetKey,
            },
            humanSummary: localize(locale, 'transpose_failed', title),
          });
        }
      }

      logger.info?.('[ConnectChart] success', {
        auditId,
        organizationId,
        actorUid: maskUid(authContext.uid),
        scaleId: selection.scale.id,
        songId: song.id,
        sourceKey,
        targetKey,
        transposed,
      });

      return res.status(200).json({
        success: true,
        protocolVersion: '1.0.0',
        auditId,
        organizationId,
        schedule: {
          id: selection.scale.id,
          organizationId,
          deepLink: `/scales/${encodeURIComponent(selection.scale.id)}`,
        },
        chart: {
          status: 'ready',
          songId: song.id,
          title,
          artist: safeText(song.artist, 160) || null,
          sourceKey,
          scheduledKey: targetKey,
          bpm: safeBpm(scheduleSettings?.bpm) ?? safeBpm(song.bpm),
          chords: finalChords,
          transposed,
          changedChordCount,
          sourceVerified: true,
        },
        humanSummary: successSummary(locale, title, targetKey, transposed),
      });
    } catch (error) {
      logger.error?.('[ConnectChart] failed', {
        auditId,
        organizationId,
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      return res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        auditId,
        humanSummary: 'MusicScale is temporarily unavailable.',
      });
    }
  };
}
