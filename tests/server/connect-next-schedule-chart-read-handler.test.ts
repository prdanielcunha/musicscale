import { describe, expect, it, vi } from 'vitest';
import { createConnectNextScheduleChartReadHandler } from '../../services/server/connect/nextScheduleChartReadHandler';

const NOW = Date.UTC(2026, 8, 10, 18, 0, 0);

function responseRecorder() {
  const captured = { statusCode: 200, payload: undefined as any, headers: {} as Record<string, string> };
  const res = {
    status(code: number) { captured.statusCode = code; return this; },
    json(payload: unknown) { captured.payload = payload; return payload; },
    setHeader(name: string, value: string) { captured.headers[name] = value; },
  };
  return { captured, res };
}

function auth(overrides: Record<string, unknown> = {}) {
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

function scale(overrides: Record<string, unknown> = {}) {
  return {
    id: 'scale-next',
    organizationId: 'org-1',
    date: '2026-09-11',
    time: '19:00',
    timeZone: 'America/Sao_Paulo',
    status: 'published',
    songIds: ['song-1', 'song-2'],
    songSettings: { 'song-1': { key: 'A', bpm: 72 } },
    eventAssignments: [{ userId: 'user-1', functionName: 'Voz', active: true }],
    ...overrides,
  };
}

function song(overrides: Record<string, unknown> = {}) {
  return {
    id: 'song-1',
    organizationId: 'org-1',
    title: 'Promessas',
    artist: 'Artista',
    key: 'G',
    bpm: 68,
    chords: '[Intro]\nG   D/F#   Em   C',
    metadata: { chordContentKey: 'G' },
    status: 'active',
    ...overrides,
  };
}

function deps(overrides: Record<string, unknown> = {}) {
  return {
    db: {},
    auth: {},
    now: () => NOW,
    resolveAuthorization: vi.fn(async () => auth()),
    loadTenantSnapshot: vi.fn(async () => ({ scales: [scale()], bandScales: [] })),
    loadSongs: vi.fn(async () => [song(), song({ id: 'song-2', title: 'Outra', chords: 'C F G', metadata: { chordContentKey: 'C' } })]),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  } as any;
}

const headers = {
  authorization: 'Bearer firebase-token',
  'x-organization-id': 'org-1',
  'x-connect-channel': 'inapp',
  'accept-language': 'pt-BR',
};

describe('Connect next-schedule chart read', () => {
  it('fails closed without auth and blocks non-inapp delivery', async () => {
    const d = deps();
    const handler = createConnectNextScheduleChartReadHandler(d);
    const first = responseRecorder();
    await handler({ headers: { 'x-organization-id': 'org-1', 'x-connect-channel': 'inapp' }, query: { title: 'Promessas' } }, first.res);
    expect(first.captured.statusCode).toBe(401);

    const second = responseRecorder();
    await handler({ headers: { ...headers, 'x-connect-channel': 'whatsapp' }, query: { title: 'Promessas' } }, second.res);
    expect(second.captured.statusCode).toBe(403);
    expect(second.captured.payload.code).toBe('CHANNEL_NOT_ALLOWED');
    expect(d.loadTenantSnapshot).not.toHaveBeenCalled();
  });

  it('returns a validated chart transposed to the per-scale scheduled key', async () => {
    const d = deps();
    const handler = createConnectNextScheduleChartReadHandler(d);
    const { captured, res } = responseRecorder();
    await handler({ headers, query: { title: 'Promessas' } }, res);

    expect(captured.statusCode).toBe(200);
    expect(captured.payload.chart.status).toBe('ready');
    expect(captured.payload.chart.sourceKey).toBe('G');
    expect(captured.payload.chart.scheduledKey).toBe('A');
    expect(captured.payload.chart.bpm).toBe(72);
    expect(captured.payload.chart.transposed).toBe(true);
    expect(captured.payload.chart.chords).toContain('A   E/G#   F#m   D');
    expect(captured.payload.chart.chords).not.toContain('G   D/F#   Em   C');
    expect(captured.payload.chart.sourceVerified).toBe(true);
    expect(captured.payload.schedule.deepLink).toBe('/scales/scale-next');
    expect(captured.headers['Cache-Control']).toBe('no-store');
  });

  it('does not invent a source key when chordContentKey is not verified', async () => {
    const d = deps({
      loadSongs: vi.fn(async () => [song({ metadata: {}, key: 'G' })]),
    });
    const handler = createConnectNextScheduleChartReadHandler(d);
    const { captured, res } = responseRecorder();
    await handler({ headers, query: { title: 'Promessas' } }, res);

    expect(captured.statusCode).toBe(200);
    expect(captured.payload.chart.status).toBe('requires_source_key_confirmation');
    expect(captured.payload.chart.chords).toBeUndefined();
    expect(captured.payload.humanSummary).toContain('tom de origem');
  });

  it('only resolves a song present in the caller next assigned schedule', async () => {
    const d = deps({
      loadSongs: vi.fn(async () => [song({ id: 'song-1' })]),
    });
    const handler = createConnectNextScheduleChartReadHandler(d);
    const { captured, res } = responseRecorder();
    await handler({ headers, query: { songId: 'foreign-song' } }, res);

    expect(captured.statusCode).toBe(404);
    expect(captured.payload.code).toBe('SONG_NOT_FOUND');
    expect(JSON.stringify(captured.payload)).not.toContain('foreign-song');
  });

  it('returns ambiguity without leaking chord content', async () => {
    const d = deps({
      loadSongs: vi.fn(async () => [
        song({ id: 'song-1', title: 'Promessas', chords: 'G D Em C' }),
        song({ id: 'song-2', title: 'Promessas', artist: 'Versão 2', chords: 'C G Am F' }),
      ]),
    });
    const handler = createConnectNextScheduleChartReadHandler(d);
    const { captured, res } = responseRecorder();
    await handler({ headers, query: { title: 'Promessas' } }, res);

    expect(captured.statusCode).toBe(409);
    expect(captured.payload.code).toBe('AMBIGUOUS_SONG');
    expect(captured.payload.options).toHaveLength(2);
    expect(JSON.stringify(captured.payload)).not.toContain('G D Em C');
    expect(JSON.stringify(captured.payload)).not.toContain('C G Am F');
  });

  it('requires scales.read and songs.read at the MusicScale authority boundary', async () => {
    const d = deps({ resolveAuthorization: vi.fn(async () => auth({ organizationRole: 'guest' })) });
    const handler = createConnectNextScheduleChartReadHandler(d);
    const { captured, res } = responseRecorder();
    await handler({ headers, query: { title: 'Promessas' } }, res);

    expect(captured.statusCode).toBe(403);
    expect(captured.payload.code).toBe('PERMISSION_DENIED');
    expect(d.loadTenantSnapshot).not.toHaveBeenCalled();
  });

  it('does not read chart data when no assigned schedule exists', async () => {
    const d = deps({ loadTenantSnapshot: vi.fn(async () => ({ scales: [], bandScales: [] })) });
    const handler = createConnectNextScheduleChartReadHandler(d);
    const { captured, res } = responseRecorder();
    await handler({ headers, query: { title: 'Promessas' } }, res);

    expect(captured.statusCode).toBe(200);
    expect(captured.payload.schedule).toBeNull();
    expect(captured.payload.chart).toBeNull();
    expect(d.loadSongs).not.toHaveBeenCalled();
  });
});
