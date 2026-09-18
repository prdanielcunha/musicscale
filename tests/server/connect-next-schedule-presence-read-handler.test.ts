import { describe, expect, it, vi } from 'vitest';
import { createConnectNextSchedulePresenceReadHandler } from '../../services/server/connect/nextSchedulePresenceReadHandler';

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

function assignedScale() {
  return {
    id: 'scale-next',
    organizationId: 'org-1',
    date: '2026-09-11',
    time: '19:00',
    timeZone: 'America/Sao_Paulo',
    durationMinutes: 120,
    status: 'published',
    eventAssignments: [{
      userId: 'user-1',
      functionId: 'voice',
      functionName: 'Voz',
      active: true,
    }],
  };
}

function deps(overrides: Record<string, unknown> = {}) {
  return {
    db: {},
    auth: {},
    now: () => NOW,
    resolveAuthorization: vi.fn(async () => activeMemberAuthorization()),
    loadTenantSnapshot: vi.fn(async () => ({ scales: [assignedScale()], bandScales: [] })),
    loadOwnResponses: vi.fn(async () => ([{
      id: 'response-1',
      organizationId: 'org-1',
      musicScaleId: 'scale-next',
      userId: 'user-1',
      status: 'accepted',
      active: true,
      respondedAt: '2026-09-10T12:00:00.000Z',
    }])),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  } as any;
}

const headers = {
  authorization: 'Bearer firebase-token',
  'x-organization-id': 'org-1',
  'accept-language': 'pt-BR',
};

describe('Connect next-schedule presence read', () => {
  it('fails closed without bearer', async () => {
    const d = deps();
    const handler = createConnectNextSchedulePresenceReadHandler(d);
    const { captured, res } = responseRecorder();
    await handler({ headers: { 'x-organization-id': 'org-1' } }, res);
    expect(captured.statusCode).toBe(401);
    expect(d.resolveAuthorization).not.toHaveBeenCalled();
  });

  it('returns only the caller own accepted response', async () => {
    const d = deps();
    const handler = createConnectNextSchedulePresenceReadHandler(d);
    const { captured, res } = responseRecorder();
    await handler({ headers }, res);
    expect(captured.statusCode).toBe(200);
    expect(captured.payload.success).toBe(true);
    expect(captured.payload.schedule.id).toBe('scale-next');
    expect(captured.payload.presence).toEqual({
      status: 'accepted',
      statuses: ['accepted'],
      responseCount: 1,
      respondedAt: '2026-09-10T12:00:00.000Z',
    });
    expect(captured.payload.humanSummary).toContain('confirmada');
    expect(d.loadOwnResponses).toHaveBeenCalledWith('org-1', 'scale-next', 'user-1', d.db);
    expect(captured.headers['Cache-Control']).toBe('no-store');
  });

  it('returns pending when own response docs have no valid response yet', async () => {
    const d = deps({
      loadOwnResponses: vi.fn(async () => ([{
        id: 'response-1',
        organizationId: 'org-1',
        musicScaleId: 'scale-next',
        userId: 'user-1',
        status: 'pending',
        active: true,
      }])),
    });
    const handler = createConnectNextSchedulePresenceReadHandler(d);
    const { captured, res } = responseRecorder();
    await handler({ headers: { ...headers, 'accept-language': 'en-US' } }, res);
    expect(captured.payload.presence.status).toBe('pending');
    expect(captured.payload.humanSummary).toContain('not responded');
  });

  it('reports mixed instead of silently choosing when own assignment responses diverge', async () => {
    const d = deps({
      loadOwnResponses: vi.fn(async () => ([
        { id: 'r1', organizationId: 'org-1', musicScaleId: 'scale-next', userId: 'user-1', status: 'accepted', active: true },
        { id: 'r2', organizationId: 'org-1', musicScaleId: 'scale-next', userId: 'user-1', status: 'maybe', active: true },
      ])),
    });
    const handler = createConnectNextSchedulePresenceReadHandler(d);
    const { captured, res } = responseRecorder();
    await handler({ headers }, res);
    expect(captured.payload.presence.status).toBe('mixed');
    expect(captured.payload.presence.statuses).toEqual(['accepted', 'maybe']);
  });

  it('does not read responses if there is no assigned next schedule', async () => {
    const d = deps({
      loadTenantSnapshot: vi.fn(async () => ({ scales: [], bandScales: [] })),
    });
    const handler = createConnectNextSchedulePresenceReadHandler(d);
    const { captured, res } = responseRecorder();
    await handler({ headers: { ...headers, 'accept-language': 'es-ES' } }, res);
    expect(captured.statusCode).toBe(200);
    expect(captured.payload.schedule).toBeNull();
    expect(captured.payload.presence).toBeNull();
    expect(d.loadOwnResponses).not.toHaveBeenCalled();
  });

  it('requires own-response capability at MusicScale authority boundary', async () => {
    const d = deps({
      resolveAuthorization: vi.fn(async () =>
        activeMemberAuthorization({ organizationRole: 'guest' }),
      ),
    });
    const handler = createConnectNextSchedulePresenceReadHandler(d);
    const { captured, res } = responseRecorder();
    await handler({ headers }, res);
    expect(captured.statusCode).toBe(403);
    expect(captured.payload.code).toBe('PERMISSION_DENIED');
    expect(d.loadOwnResponses).not.toHaveBeenCalled();
  });

  it('fails closed when authorization is unavailable', async () => {
    const d = deps({
      resolveAuthorization: vi.fn(async () => { throw new Error('auth unavailable'); }),
    });
    const handler = createConnectNextSchedulePresenceReadHandler(d);
    const { captured, res } = responseRecorder();
    await handler({ headers }, res);
    expect(captured.statusCode).toBe(503);
    expect(captured.payload.code).toBe('SERVICE_UNAVAILABLE');
  });
});
