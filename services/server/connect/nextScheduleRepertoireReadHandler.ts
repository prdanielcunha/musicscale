import crypto from 'crypto';
import { resolveOrganizationAuthorization } from '../organizationAuthorization.js';
import { buildEffectiveAccessContext, hasMusicScaleCapability } from '../../../utils/rbac.js';
import {
  ConnectBandScaleRecord,
  ConnectScaleRecord,
  selectNextAssignedSchedule,
} from './nextScheduleSelector.js';

type MinimalRequest = {
  headers: Record<string, string | string[] | undefined>;
};

type MinimalResponse = {
  status(code: number): MinimalResponse;
  json(payload: unknown): unknown;
  setHeader?(name: string, value: string): void;
};

type AuthorizationResult = Awaited<ReturnType<typeof resolveOrganizationAuthorization>>;

export interface ConnectRepertoireSongRecord {
  id: string;
  organizationId?: string | null;
  title?: string | null;
  artist?: string | null;
  key?: string | null;
  originalKey?: string | null;
  selectedKey?: string | null;
  bpm?: number | null;
  chords?: string | null;
  lyrics?: string | null;
  status?: string | null;
}

export interface ConnectNextScheduleRepertoireDependencies {
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
  ) => Promise<ConnectRepertoireSongRecord[]>;
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
  if (!value || !/^Bearer\s+\S+/i.test(value)) {
    return { ok: false, code: 'UNAUTHORIZED' };
  }
  return { ok: true, value };
}

function normalizeLocale(value: string): 'pt-BR' | 'en' | 'es' {
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('es')) return 'es';
  return 'pt-BR';
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

function localizeNoSchedule(locale: 'pt-BR' | 'en' | 'es'): string {
  if (locale === 'en') return 'I could not find an upcoming schedule assigned to you.';
  if (locale === 'es') return 'No encontré una próxima escala asignada a ti.';
  return 'Não encontrei uma próxima escala atribuída a você.';
}

function localizeRepertoire(
  locale: 'pt-BR' | 'en' | 'es',
  titles: string[],
  total: number,
): string {
  if (total === 0) {
    if (locale === 'en') return 'Your next schedule does not have repertoire yet.';
    if (locale === 'es') return 'Tu próxima escala todavía no tiene repertorio.';
    return 'Sua próxima escala ainda não tem repertório.';
  }

  const preview = titles.slice(0, 5).join(', ');
  const remaining = Math.max(0, total - Math.min(total, 5));

  if (locale === 'en') {
    return remaining > 0
      ? `Your next schedule has ${total} songs: ${preview} and ${remaining} more.`
      : `Your next schedule has ${total} songs: ${preview}.`;
  }
  if (locale === 'es') {
    return remaining > 0
      ? `Tu próxima escala tiene ${total} canciones: ${preview} y ${remaining} más.`
      : `Tu próxima escala tiene ${total} canciones: ${preview}.`;
  }
  return remaining > 0
    ? `Sua próxima escala tem ${total} músicas: ${preview} e mais ${remaining}.`
    : `Sua próxima escala tem ${total} músicas: ${preview}.`;
}

function maskUid(uid: string): string {
  if (uid.length <= 6) return '***';
  return `${uid.slice(0, 3)}***${uid.slice(-3)}`;
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
): Promise<ConnectRepertoireSongRecord[]> {
  const docs = await Promise.all(
    songIds.map(async (songId) => {
      const snapshot = await db.collection('songs').doc(songId).get();
      if (!snapshot.exists) return null;
      const data = snapshot.data() || {};
      if (data.organizationId !== organizationId) return null;
      return { id: snapshot.id, ...data } as ConnectRepertoireSongRecord;
    }),
  );

  return docs.filter((song): song is ConnectRepertoireSongRecord => Boolean(song));
}

function normalizeAuthorizationResult(value: AuthorizationResult): AuthorizationResult {
  return value;
}

export function createConnectNextScheduleRepertoireReadHandler(
  deps: ConnectNextScheduleRepertoireDependencies,
) {
  const resolveAuthorization = deps.resolveAuthorization ?? resolveOrganizationAuthorization;
  const loadTenantSnapshot = deps.loadTenantSnapshot ?? loadTenantSnapshotFromFirestore;
  const loadSongs = deps.loadSongs ?? loadSongsFromFirestore;
  const now = deps.now ?? Date.now;
  const logger = deps.logger ?? console;

  return async function handleConnectNextScheduleRepertoireRead(
    req: MinimalRequest,
    res: MinimalResponse,
  ) {
    const auditId = `ms-repertoire-${crypto.randomUUID()}`;
    res.setHeader?.('Cache-Control', 'no-store');

    const bearerResolution = resolveBearerHeader(req);
    const organizationId = getHeader(req, 'x-organization-id');
    const locale = normalizeLocale(getHeader(req, 'accept-language'));

    if (bearerResolution.ok === false) {
      return res.status(401).json({
        success: false,
        code: bearerResolution.code,
        auditId,
        humanSummary: 'Authentication required.',
      });
    }

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        code: 'ORGANIZATION_REQUIRED',
        auditId,
        humanSummary: 'Organization context is required.',
      });
    }

    try {
      const authorization = normalizeAuthorizationResult(
        await resolveAuthorization(
          bearerResolution.value,
          organizationId,
          deps.db,
          deps.auth,
          { checkRevoked: false },
        ),
      );

      if (authorization.error || !authorization.context) {
        const status = authorization.statusCode || 403;
        logger.warn?.('[ConnectRepertoire] authorization denied', {
          auditId,
          organizationId,
          status,
          code: authorization.error || 'FORBIDDEN',
        });
        return res.status(status).json({
          success: false,
          code: authorization.error || 'FORBIDDEN',
          auditId,
          humanSummary: status === 401 ? 'Authentication required.' : 'Access denied.',
        });
      }

      const authContext = authorization.context;
      const effectiveOrganizationRole = authContext.isOwner
        ? 'owner'
        : authContext.organizationRole || null;
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
        logger.warn?.('[ConnectRepertoire] read capability denied', {
          auditId,
          organizationId,
          actorUid: maskUid(authContext.uid),
        });
        return res.status(403).json({
          success: false,
          code: 'PERMISSION_DENIED',
          auditId,
          humanSummary: 'Access denied.',
        });
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
          repertoire: [],
          humanSummary: localizeNoSchedule(locale),
        });
      }

      const scale = selection.scale;
      const songIds = uniqueSongIds(scale.songIds);
      const songs = songIds.length > 0
        ? await loadSongs(organizationId, songIds, deps.db)
        : [];
      const songsById = new Map(songs.map((song) => [song.id, song]));
      const settings = scale.songSettings && typeof scale.songSettings === 'object'
        ? scale.songSettings
        : {};

      const repertoire = songIds.flatMap((songId, index) => {
        const song = songsById.get(songId);
        if (!song) return [];

        const perScale = settings[songId] && typeof settings[songId] === 'object'
          ? settings[songId]
          : {};
        const sourceKey =
          safeText(song.key, 24) ||
          safeText(song.selectedKey, 24) ||
          safeText(song.originalKey, 24) ||
          null;
        const scheduledKey = safeText(perScale?.key, 24) || sourceKey;
        const sourceBpm = safeBpm(song.bpm);
        const scheduledBpm = safeBpm(perScale?.bpm) ?? sourceBpm;
        const chords = typeof song.chords === 'string' ? song.chords.trim() : '';
        const lyrics = typeof song.lyrics === 'string' ? song.lyrics.trim() : '';

        return [{
          id: song.id,
          order: index + 1,
          title: safeText(song.title, 180) || 'Sem título',
          artist: safeText(song.artist, 160) || null,
          sourceKey,
          scheduledKey,
          bpm: scheduledBpm,
          hasChords: chords.length > 0,
          hasLyrics: lyrics.length > 0,
        }];
      });

      const schedule = {
        id: scale.id,
        organizationId,
        date: scale.date || null,
        time: scale.time || null,
        timeZone: scale.timeZone || null,
        assignmentSource: selection.assignmentSource,
        functionNames: [...selection.functionNames],
        deepLink: `/scales/${encodeURIComponent(scale.id)}`,
      };

      logger.info?.('[ConnectRepertoire] success', {
        auditId,
        organizationId,
        actorUid: maskUid(authContext.uid),
        scaleId: scale.id,
        repertoireCount: repertoire.length,
      });

      return res.status(200).json({
        success: true,
        protocolVersion: '1.0.0',
        auditId,
        organizationId,
        schedule,
        repertoire,
        humanSummary: localizeRepertoire(
          locale,
          repertoire.map((song) => song.title),
          repertoire.length,
        ),
      });
    } catch (error) {
      logger.error?.('[ConnectRepertoire] failed', {
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
