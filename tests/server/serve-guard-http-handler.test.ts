import { describe, expect, it, vi } from 'vitest';
import {
  createServeGuardHttpHandlers,
  type ServeGuardHttpDependencies,
} from '../../services/server/serveGuard/serveGuardHttpHandler';
import type { ServeGuardPreference } from '../../services/server/serveGuard/serveGuardPolicy';

const ORG = 'org_01';
const USER = 'user_01';
const OTHER = 'user_02';

function authResult(
  uid: string,
  organizationRole: string | null,
  options: { isActive?: boolean; systemRole?: string | null; isOwner?: boolean } = {},
): any {
  return {
    context: {
      uid,
      email: uid + '@example.test',
      systemRole: options.systemRole ?? null,
      organizationRole,
      isActive: options.isActive ?? true,
      isOwner: options.isOwner ?? organizationRole === 'owner',
      capabilities: [],
    },
  };
}

function request(input: {
  params?: Record<string, string>;
  body?: Record<string, unknown>;
  authorization?: string;
} = {}): any {
  return {
    params: input.params ?? {},
    body: input.body ?? {},
    headers: {
      authorization: input.authorization ?? 'Bearer valid-token',
    },
  };
}

function response() {
  const state: any = {
    statusCode: 200,
    payload: null,
    headers: {},
  };
  state.status = (code: number) => {
    state.statusCode = code;
    return state;
  };
  state.json = (payload: unknown) => {
    state.payload = payload;
    return state;
  };
  state.setHeader = (name: string, value: string) => {
    state.headers[name.toLowerCase()] = value;
  };
  return state;
}

function storedPreference(userId = USER): ServeGuardPreference {
  return {
    schemaVersion: 1,
    organizationId: ORG,
    userId,
    maxServicesPerWeek: 2,
    maxServicesPerMonth: 6,
    unavailableDates: [],
    pausedUntil: null,
    updatedAtMs: 1,
    updatedBy: userId,
  };
}

function dependencies(
  authorization: any,
  overrides: Partial<ServeGuardHttpDependencies> = {},
): ServeGuardHttpDependencies {
  return {
    db: {},
    auth: {},
    now: () => Date.UTC(2026, 8, 18, 12, 0, 0),
    resolveAuthorization: vi.fn(async () => authorization),
    targetIsActiveMember: vi.fn(async () => true),
    loadPreference: vi.fn(async (_org, userId) => storedPreference(userId)),
    savePreference: vi.fn(async () => undefined),
    loadScales: vi.fn(async () => [
      {
        id: 'scale_1',
        organizationId: ORG,
        date: '2026-09-21',
        status: 'published',
        eventAssignments: [{ userId: OTHER, active: true }],
      },
      {
        id: 'scale_2',
        organizationId: ORG,
        date: '2026-09-23',
        status: 'published',
        eventAssignments: [{ userId: OTHER, active: true }],
      },
    ]),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  };
}

describe('ServeGuard HTTP boundary', () => {
  it('lets an active member write only their own preference', async () => {
    const deps = dependencies(authResult(USER, 'member'));
    const handlers = createServeGuardHttpHandlers(deps);
    const res = response();

    await handlers.putPreference(
      request({
        params: { organizationId: ORG, userId: USER },
        body: {
          maxServicesPerWeek: 2,
          maxServicesPerMonth: 5,
          unavailableDates: ['2026-09-27'],
          pausedUntil: null,
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.payload.preference).toMatchObject({
      organizationId: ORG,
      userId: USER,
      maxServicesPerWeek: 2,
      maxServicesPerMonth: 5,
      unavailableDates: ['2026-09-27'],
      updatedBy: USER,
    });
    expect(deps.savePreference).toHaveBeenCalledTimes(1);
  });

  it('does not let a leader rewrite another member preference', async () => {
    const deps = dependencies(authResult(USER, 'leader'));
    const handlers = createServeGuardHttpHandlers(deps);
    const res = response();

    await handlers.putPreference(
      request({
        params: { organizationId: ORG, userId: OTHER },
        body: {
          maxServicesPerWeek: 1,
          unavailableDates: [],
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(res.payload.code).toBe('SERVEGUARD_SELF_WRITE_REQUIRED');
    expect(deps.savePreference).not.toHaveBeenCalled();
  });

  it('lets tenant leadership evaluate another active member prospectively', async () => {
    const deps = dependencies(authResult(USER, 'leader'));
    const handlers = createServeGuardHttpHandlers(deps);
    const res = response();

    await handlers.evaluate(
      request({
        params: { organizationId: ORG },
        body: {
          userId: OTHER,
          candidateDate: '2026-09-25',
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.payload.evaluation).toMatchObject({
      organizationId: ORG,
      userId: OTHER,
      advisoryOnly: true,
      primarySignal: 'over_weekly_limit',
      requiresExplicitOverride: true,
    });
    expect(res.payload.evaluation.scheduledLoad.week).toEqual({
      current: 2,
      projected: 3,
      limit: 2,
    });
  });

  it('denies a normal member from evaluating another person', async () => {
    const deps = dependencies(authResult(USER, 'member'));
    const handlers = createServeGuardHttpHandlers(deps);
    const res = response();

    await handlers.evaluate(
      request({
        params: { organizationId: ORG },
        body: {
          userId: OTHER,
          candidateDate: '2026-09-25',
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(res.payload.code).toBe('SERVEGUARD_EVALUATION_AUTHORITY_REQUIRED');
    expect(deps.loadScales).not.toHaveBeenCalled();
  });

  it('lets a member evaluate their own advisory state', async () => {
    const deps = dependencies(authResult(USER, 'member'), {
      loadScales: vi.fn(async () => []),
    });
    const handlers = createServeGuardHttpHandlers(deps);
    const res = response();

    await handlers.evaluate(
      request({
        params: { organizationId: ORG },
        body: {
          userId: USER,
          candidateDate: '2026-09-25',
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.payload.evaluation.userId).toBe(USER);
    expect(res.payload.evaluation.advisoryOnly).toBe(true);
  });

  it('fails closed when the target is not an active member of the tenant', async () => {
    const deps = dependencies(authResult(USER, 'leader'), {
      targetIsActiveMember: vi.fn(async () => false),
    });
    const handlers = createServeGuardHttpHandlers(deps);
    const res = response();

    await handlers.getPreference(
      request({
        params: { organizationId: ORG, userId: OTHER },
      }),
      res,
    );

    expect(res.statusCode).toBe(404);
    expect(res.payload.code).toBe('TARGET_MEMBER_NOT_FOUND');
    expect(deps.loadPreference).not.toHaveBeenCalled();
  });

  it('does not allow global governance alone to read another person workload preference', async () => {
    const deps = dependencies(
      authResult(USER, null, {
        systemRole: 'ceo',
        isActive: true,
        isOwner: false,
      }),
    );
    const handlers = createServeGuardHttpHandlers(deps);
    const res = response();

    await handlers.getPreference(
      request({
        params: { organizationId: ORG, userId: OTHER },
      }),
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(res.payload.code).toBe('SERVEGUARD_READ_AUTHORITY_REQUIRED');
  });

  it('rejects invalid preference payloads before persistence', async () => {
    const deps = dependencies(authResult(USER, 'member'));
    const handlers = createServeGuardHttpHandlers(deps);
    const res = response();

    await handlers.putPreference(
      request({
        params: { organizationId: ORG, userId: USER },
        body: {
          maxServicesPerWeek: 0,
          maxServicesPerMonth: 6,
          unavailableDates: [],
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.payload.code).toBe('INVALID_SERVEGUARD_PREFERENCE');
    expect(deps.savePreference).not.toHaveBeenCalled();
  });

  it('uses private no-store responses for workload preference data', async () => {
    const deps = dependencies(authResult(USER, 'member'));
    const handlers = createServeGuardHttpHandlers(deps);
    const res = response();

    await handlers.getPreference(
      request({
        params: { organizationId: ORG, userId: USER },
      }),
      res,
    );

    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers.pragma).toBe('no-cache');
  });
});
