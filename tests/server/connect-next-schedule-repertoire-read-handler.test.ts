import { describe, expect, it, vi } from 'vitest';
import { createConnectNextScheduleRepertoireReadHandler } from '../../services/server/connect/nextScheduleRepertoireReadHandler';

const NOW = Date.UTC(2026, 8, 10, 18, 0, 0);

function responseRecorder() {
  const captured = {
    statusCode: 200,
    payload: undefined as any,
    headers: {} as Record<string, string>,
  };
  const res = {
    status(code: number) { captured.statusCode = code; return this; },
    json(payload: unknown) { captured.payload = payload; return payload; },
    setHeader(name: string, value: string) { captured.headers[name] = value; },
  };
  return { captured, res };
}

function request(headers: Record<string, string> = {}) {
  return { headers };
}

function activeMemberAuthorization(overrides: Record<string, unknown> = {}) {
  return {
    context: {
      uid: 'user-1',
      email: 'user@example.com',
      systemRole: null,
      organizationRole: 'member',
      isActive: true,
      isOwner: false,
      capabilities: [],
      ...overrides,
    },
  };
}

function assignedScale(overrides: Record<string, unknown> = {}) {
  return {
    id: 'scale-next',
    organizationId: 'org-1',
    date: '2026-09-11',
    time: '19:00',
    timeZone: 'America/Sao_Paulo',
    durationMinutes: 120,
    status: 'published',
    songIds: ['song-2', 'song-1'],
    songSettings: {
      'song-2': { key: 'A', bpm: 72 },
    },
    eventAssignments: [{
      userId: 'user-1',
      functionId: 'voice',
      functionName: 'Voz',
      active: true,
    }],
    ...overrides,
  };
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    db: {},
    auth: {},
    now: () => NOW,
    resolveAuthorization: vi.fn(async () => activeMemberAuthorization()),
    loadTenantSnapshot: vi.fn(async () => ({
      scales: [assignedScale()],
      bandScales: [],
    })),
    loadSongs: vi.fn(async () => ([
      {
        id: 'song-1',
        organizationId: 'org-1',
        title: 'Promessas',
        artist: 'Artista 1',
        key: 'G#m',
        bpm: 70,
        chords: '[Intro] G#m E B F#',
        lyrics: 'Deus de Abraão',
        status: 'active',
      },
      {
        id: 'song-2',
        organizationId: 'org-1',
        title: 'Bondade de Deus',
        artist: 'Artista 2',
        key: 'G',
        bpm: 68,
        chords: '',
        lyrics: 'Te amo Deus',
        status: 'active',
      },
    ])),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  } as any;
}

const authorizedHeaders = {
  authorization: 'Bearer firebase-token',
  'x-organization-id': 'org-1',
  'accept-language': 'pt-BR',
};

describe('createConnectNextScheduleRepertoireReadHandler', () => {
  it('fails closed before authorization when bearer is missing', async () => {
    const deps = dependencies();
    const handler = createConnectNextScheduleRepertoireReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler(request({ 'x-organization-id': 'org-1' }), res);

    expect(captured.statusCode).toBe(401);
    expect(captured.payload.code).toBe('UNAUTHORIZED');
    expect(deps.resolveAuthorization).not.toHaveBeenCalled();
    expect(deps.loadTenantSnapshot).not.toHaveBeenCalled();
    expect(deps.loadSongs).not.toHaveBeenCalled();
  });

  it('requires organization context before tenant reads', async () => {
    const deps = dependencies();
    const handler = createConnectNextScheduleRepertoireReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler(request({ authorization: 'Bearer firebase-token' }), res);

    expect(captured.statusCode).toBe(400);
    expect(captured.payload.code).toBe('ORGANIZATION_REQUIRED');
    expect(deps.resolveAuthorization).not.toHaveBeenCalled();
  });

  it('returns ordered repertoire only for the next schedule assigned to the actor', async () => {
    const deps = dependencies();
    const handler = createConnectNextScheduleRepertoireReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler(request(authorizedHeaders), res);

    expect(captured.statusCode).toBe(200);
    expect(captured.payload.success).toBe(true);
    expect(captured.payload.organizationId).toBe('org-1');
    expect(captured.payload.schedule.id).toBe('scale-next');
    expect(captured.payload.schedule.deepLink).toBe('/scales/scale-next');
    expect(captured.payload.repertoire.map((song: any) => song.id)).toEqual(['song-2', 'song-1']);
    expect(captured.payload.repertoire[0]).toMatchObject({
      order: 1,
      title: 'Bondade de Deus',
      sourceKey: 'G',
      scheduledKey: 'A',
      bpm: 72,
      hasChords: false,
      hasLyrics: true,
    });
    expect(captured.payload.repertoire[1]).toMatchObject({
      order: 2,
      title: 'Promessas',
      scheduledKey: 'G#m',
      bpm: 70,
      hasChords: true,
    });
    expect(captured.payload.humanSummary).toContain('2 músicas');
    expect(deps.loadSongs).toHaveBeenCalledWith(
      'org-1',
      ['song-2', 'song-1'],
      deps.db,
    );
    expect(captured.headers['Cache-Control']).toBe('no-store');
  });

  it('requires both scales.read and songs.read at the MusicScale authority boundary', async () => {
    const deps = dependencies({
      resolveAuthorization: vi.fn(async () =>
        activeMemberAuthorization({ organizationRole: 'guest' }),
      ),
    });
    const handler = createConnectNextScheduleRepertoireReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler(request(authorizedHeaders), res);

    expect(captured.statusCode).toBe(403);
    expect(captured.payload.code).toBe('PERMISSION_DENIED');
    expect(deps.loadTenantSnapshot).not.toHaveBeenCalled();
    expect(deps.loadSongs).not.toHaveBeenCalled();
  });

  it('does not read repertoire when no assigned schedule exists', async () => {
    const deps = dependencies({
      loadTenantSnapshot: vi.fn(async () => ({ scales: [], bandScales: [] })),
    });
    const handler = createConnectNextScheduleRepertoireReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler(
      request({ ...authorizedHeaders, 'accept-language': 'es-ES' }),
      res,
    );

    expect(captured.statusCode).toBe(200);
    expect(captured.payload.schedule).toBeNull();
    expect(captured.payload.repertoire).toEqual([]);
    expect(captured.payload.humanSummary).toContain('No encontré');
    expect(deps.loadSongs).not.toHaveBeenCalled();
  });

  it('omits missing/foreign song records instead of fabricating repertoire data', async () => {
    const deps = dependencies({
      loadSongs: vi.fn(async () => ([
        {
          id: 'song-1',
          organizationId: 'org-1',
          title: 'Promessas',
          artist: 'Artista 1',
          key: 'G#m',
          chords: 'G#m E B F#',
        },
      ])),
    });
    const handler = createConnectNextScheduleRepertoireReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler(request(authorizedHeaders), res);

    expect(captured.statusCode).toBe(200);
    expect(captured.payload.repertoire).toHaveLength(1);
    expect(captured.payload.repertoire[0].id).toBe('song-1');
    expect(JSON.stringify(captured.payload)).not.toContain('org-2');
  });

  it('fails closed when authorization or tenant data is unavailable', async () => {
    const deps = dependencies({
      resolveAuthorization: vi.fn(async () => {
        throw new Error('auth unavailable');
      }),
    });
    const handler = createConnectNextScheduleRepertoireReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler(request(authorizedHeaders), res);

    expect(captured.statusCode).toBe(503);
    expect(captured.payload.code).toBe('SERVICE_UNAVAILABLE');
    expect(deps.loadTenantSnapshot).not.toHaveBeenCalled();
  });
});
