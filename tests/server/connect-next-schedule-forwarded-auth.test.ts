import { describe, expect, it, vi } from 'vitest';
import { createConnectNextScheduleReadHandler } from '../../services/server/connect/nextScheduleReadHandler';

function responseRecorder() {
  const captured = { statusCode: 200, payload: undefined as any };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      captured.payload = payload;
      return payload;
    },
    setHeader() {},
  };
  return { captured, res };
}

function dependencies() {
  const resolveAuthorization = vi.fn(async () => ({
    context: {
      uid: 'user-1',
      email: 'user@example.com',
      systemRole: null,
      organizationRole: 'member',
      isActive: true,
      isOwner: false,
      capabilities: [],
    },
  }));

  return {
    db: {},
    auth: {},
    now: () => Date.UTC(2026, 8, 11, 12, 0, 0),
    resolveAuthorization,
    loadTenantSnapshot: vi.fn(async () => ({ scales: [], bandScales: [] })),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as any;
}

describe('Connect forwarded bearer transport fallback', () => {
  it('accepts the server-to-server fallback header when Authorization is stripped upstream', async () => {
    const deps = dependencies();
    const handler = createConnectNextScheduleReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler({
      headers: {
        'x-connect-user-authorization': 'Bearer firebase-user-token',
        'x-organization-id': 'org-1',
        'accept-language': 'pt-BR',
      },
    }, res);

    expect(captured.statusCode).toBe(200);
    expect(captured.payload.success).toBe(true);
    expect(deps.resolveAuthorization).toHaveBeenCalledWith(
      'Bearer firebase-user-token',
      'org-1',
      deps.db,
      deps.auth,
      { checkRevoked: false },
    );
  });

  it('prefers the explicitly forwarded end-user bearer when infrastructure replaces Authorization', async () => {
    const deps = dependencies();
    const handler = createConnectNextScheduleReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler({
      headers: {
        authorization: 'Bearer infrastructure-credential',
        'x-connect-user-authorization': 'Bearer firebase-user-token',
        'x-organization-id': 'org-1',
      },
    }, res);

    expect(captured.statusCode).toBe(200);
    expect(captured.payload.success).toBe(true);
    expect(deps.resolveAuthorization).toHaveBeenCalledWith(
      'Bearer firebase-user-token',
      'org-1',
      deps.db,
      deps.auth,
      { checkRevoked: false },
    );
  });

  it('still rejects a malformed forwarded bearer instead of silently trusting the standard header', async () => {
    const deps = dependencies();
    const handler = createConnectNextScheduleReadHandler(deps);
    const { captured, res } = responseRecorder();

    await handler({
      headers: {
        authorization: 'Bearer otherwise-valid-token',
        'x-connect-user-authorization': 'not-a-bearer',
        'x-organization-id': 'org-1',
      },
    }, res);

    expect(captured.statusCode).toBe(401);
    expect(captured.payload.code).toBe('UNAUTHORIZED');
    expect(deps.resolveAuthorization).not.toHaveBeenCalled();
    expect(deps.loadTenantSnapshot).not.toHaveBeenCalled();
  });
});
