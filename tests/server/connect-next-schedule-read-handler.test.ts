import { describe, expect, it, vi } from 'vitest';
import { createConnectNextScheduleReadHandler } from '../../services/server/connect/nextScheduleReadHandler';

const NOW = Date.UTC(2026, 8, 10, 18, 0, 0);

type CapturedResponse = {
  statusCode: number;
  payload: any;
  headers: Record<string, string>;
};

function responseRecorder() {
  const captured: CapturedResponse = {
    statusCode: 200,
    payload: undefined,
    headers: {},
  };

  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      captured.payload = payload;
      return payload;
    },
    setHeader(name: string, value: string) {
      captured.headers[name] = value;
    },
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
    eventNameId: 'event-name-1',
    eventTypeId: 'event-type-1',
    locationId: 'location-1',
    songIds: ['song-1', 'song-2'],
    eventAssignments: [
      {
        userId: 'user-1',
        functionId: 'voice',
        functionName: 'Voz',
        active: true,
      },
    ],
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
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  } as any;
}

const authorizedHeaders = {
  authorization: 'Bearer firebase-token',
  'x-organization-id': 'org-1',
  'accept-language': 'pt-BR',
};

describe('createConnectNextScheduleReadHandler', () => {
  it('fails closed before authorization when bearer authentication is missing', async () => {
    const deps = dependencies();
    const handler = createConnectNextScheduleReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler(request({ 'x-organization-id': 'org-1' }), res);

    expect(captured.statusCode).toBe(401);
    expect(captured.payload.code).toBe('UNAUTHORIZED');
    expect(deps.resolveAuthorization).not.toHaveBeenCalled();
    expect(deps.loadTenantSnapshot).not.toHaveBeenCalled();
  });

  it('requires explicit organization context before reading any tenant data', async () => {
    const deps = dependencies();
    const handler = createConnectNextScheduleReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler(request({ authorization: 'Bearer firebase-token' }), res);

    expect(captured.statusCode).toBe(400);
    expect(captured.payload.code).toBe('ORGANIZATION_REQUIRED');
    expect(deps.resolveAuthorization).not.toHaveBeenCalled();
    expect(deps.loadTenantSnapshot).not.toHaveBeenCalled();
  });

  it('revalidates authorization and returns the real tenant-scoped next assigned schedule', async () => {
    const deps = dependencies();
    const handler = createConnectNextScheduleReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler(request(authorizedHeaders), res);

    expect(captured.statusCode).toBe(200);
    expect(captured.payload.success).toBe(true);
    expect(captured.payload.organizationId).toBe('org-1');
    expect(captured.payload.schedule.id).toBe('scale-next');
    expect(captured.payload.schedule.organizationId).toBe('org-1');
    expect(captured.payload.schedule.songIds).toEqual(['song-1', 'song-2']);
    expect(captured.payload.schedule.assignmentSource).toBe('event_assignment');
    expect(captured.payload.schedule.functionNames).toEqual(['Voz']);
    expect(captured.payload.schedule.deepLink).toBe('/scales/scale-next');
    expect(captured.payload.humanSummary).toContain('11/09/2026');
    expect(deps.resolveAuthorization).toHaveBeenCalledWith(
      'Bearer firebase-token',
      'org-1',
      deps.db,
      deps.auth,
      { checkRevoked: false },
    );
    expect(deps.loadTenantSnapshot).toHaveBeenCalledWith('org-1', deps.db);
    expect(captured.headers['Cache-Control']).toBe('no-store');
  });

  it('denies inactive non-global memberships before the Firestore read', async () => {
    const deps = dependencies({
      resolveAuthorization: vi.fn(async () =>
        activeMemberAuthorization({ isActive: false }),
      ),
    });
    const handler = createConnectNextScheduleReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler(request(authorizedHeaders), res);

    expect(captured.statusCode).toBe(403);
    expect(captured.payload.code).toBe('PERMISSION_DENIED');
    expect(deps.loadTenantSnapshot).not.toHaveBeenCalled();
  });

  it('preserves canonical global administrator access without trusting Connect-side role claims', async () => {
    const deps = dependencies({
      resolveAuthorization: vi.fn(async () =>
        activeMemberAuthorization({
          systemRole: 'ceo',
          organizationRole: null,
          isActive: false,
        }),
      ),
    });
    const handler = createConnectNextScheduleReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler(request(authorizedHeaders), res);

    expect(captured.statusCode).toBe(200);
    expect(captured.payload.schedule.id).toBe('scale-next');
    expect(deps.loadTenantSnapshot).toHaveBeenCalledTimes(1);
  });

  it('returns no schedule instead of leaking a record from another organization', async () => {
    const deps = dependencies({
      loadTenantSnapshot: vi.fn(async () => ({
        scales: [assignedScale({ organizationId: 'org-2' })],
        bandScales: [],
      })),
    });
    const handler = createConnectNextScheduleReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler(request(authorizedHeaders), res);

    expect(captured.statusCode).toBe(200);
    expect(captured.payload.success).toBe(true);
    expect(captured.payload.schedule).toBeNull();
    expect(JSON.stringify(captured.payload)).not.toContain('org-2');
  });

  it('uses the linked BandScale as assignment authority when present in the same tenant', async () => {
    const deps = dependencies({
      loadTenantSnapshot: vi.fn(async () => ({
        scales: [
          assignedScale({
            bandScaleId: 'band-1',
            eventAssignments: [{ userId: 'another-user', active: true }],
          }),
        ],
        bandScales: [
          {
            id: 'band-1',
            organizationId: 'org-1',
            assignments: [
              { userId: 'user-1', instrumentId: 'keys', active: true },
            ],
          },
        ],
      })),
    });
    const handler = createConnectNextScheduleReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler(request(authorizedHeaders), res);

    expect(captured.statusCode).toBe(200);
    expect(captured.payload.schedule.assignmentSource).toBe('band_scale');
    expect(captured.payload.schedule.functionNames).toEqual(['keys']);
  });

  it('returns a localized safe no-schedule answer', async () => {
    const deps = dependencies({
      loadTenantSnapshot: vi.fn(async () => ({ scales: [], bandScales: [] })),
    });
    const handler = createConnectNextScheduleReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler(
      request({ ...authorizedHeaders, 'accept-language': 'es-ES' }),
      res,
    );

    expect(captured.statusCode).toBe(200);
    expect(captured.payload.schedule).toBeNull();
    expect(captured.payload.humanSummary).toContain('No encontré');
  });

  it('fails closed when authorization or data access is unavailable', async () => {
    const deps = dependencies({
      resolveAuthorization: vi.fn(async () => {
        throw new Error('auth unavailable');
      }),
    });
    const handler = createConnectNextScheduleReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler(request(authorizedHeaders), res);

    expect(captured.statusCode).toBe(503);
    expect(captured.payload.code).toBe('SERVICE_UNAVAILABLE');
    expect(deps.loadTenantSnapshot).not.toHaveBeenCalled();
  });
});
