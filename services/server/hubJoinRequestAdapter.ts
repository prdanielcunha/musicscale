import { resolveHubOrigin } from './hubInvitationAdapter.js';

const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;
const CREATE_SUCCESS_REASONS = new Set(['JOIN_REQUEST_CREATED', 'ALREADY_PENDING', 'ALREADY_MEMBER']);
const APPROVE_SUCCESS_REASONS = new Set(['JOIN_REQUEST_APPROVED', 'ALREADY_APPROVED']);
const REJECT_SUCCESS_REASONS = new Set(['JOIN_REQUEST_REJECTED', 'ALREADY_REJECTED']);

export class HubJoinRequestError extends Error {
  constructor(public status: number, public reasonCode: string, public ambiguous = false) {
    super(reasonCode);
  }
}

function validateId(value: unknown, reasonCode: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!VALID_ID.test(normalized)) throw new HubJoinRequestError(400, reasonCode);
  return normalized;
}

function validateCreateSuccess(data: any, organizationId: string) {
  const reasonCode = typeof data?.reasonCode === 'string' ? data.reasonCode.trim() : '';
  if (data?.success !== true || !CREATE_SUCCESS_REASONS.has(reasonCode)) {
    throw new HubJoinRequestError(502, 'INVALID_HUB_RESPONSE', true);
  }
  if (reasonCode !== 'ALREADY_MEMBER') {
    const requestId = typeof data?.requestId === 'string' ? data.requestId.trim() : '';
    if (!VALID_ID.test(requestId) || typeof data?.generation !== 'number' || !Number.isInteger(data.generation) || data.generation < 1) {
      throw new HubJoinRequestError(502, 'INVALID_HUB_RESPONSE', true);
    }
    return { success: true as const, reasonCode, organizationId, requestId, generation: data.generation };
  }
  return { success: true as const, reasonCode, organizationId };
}

function validateResolutionSuccess(data: any, organizationId: string, requestId: string, command: 'approve' | 'reject') {
  const reasonCode = typeof data?.reasonCode === 'string' ? data.reasonCode.trim() : '';
  const allowed = command === 'approve' ? APPROVE_SUCCESS_REASONS : REJECT_SUCCESS_REASONS;
  if (data?.success !== true || !allowed.has(reasonCode)) {
    throw new HubJoinRequestError(502, 'INVALID_HUB_RESPONSE', true);
  }
  if (typeof data?.generation !== 'number' || !Number.isInteger(data.generation) || data.generation < 1) {
    throw new HubJoinRequestError(502, 'INVALID_HUB_RESPONSE', true);
  }
  return { success: true as const, reasonCode, organizationId, requestId, generation: data.generation };
}

export class HubJoinRequestAdapter {
  constructor(private options: { origin?: string; fetch?: typeof fetch; timeoutMs?: number } = {}) {}

  private async post(path: string, bearer: string): Promise<any> {
    if (typeof bearer !== 'string' || !bearer.startsWith('Bearer ') || bearer.length <= 7) {
      throw new HubJoinRequestError(401, 'UNAUTHORIZED');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 8000);
    try {
      const response = await (this.options.fetch || fetch)(`${resolveHubOrigin(this.options.origin)}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: bearer },
        body: JSON.stringify({}),
        signal: controller.signal
      });
      let data: any = {};
      try { data = await response.json(); } catch { throw new HubJoinRequestError(502, 'INVALID_HUB_RESPONSE', true); }
      if (!response.ok) {
        const reasonCode = String(data?.reasonCode || data?.error || 'HUB_REQUEST_FAILED');
        throw new HubJoinRequestError(response.status, reasonCode, response.status >= 500);
      }
      return data;
    } catch (error) {
      if (error instanceof HubJoinRequestError) throw error;
      throw new HubJoinRequestError(503, 'HUB_UNAVAILABLE', true);
    } finally {
      clearTimeout(timer);
    }
  }

  async create(bearer: string, organizationIdInput: string) {
    const organizationId = validateId(organizationIdInput, 'INVALID_ORGANIZATION_ID');
    const data = await this.post(`/api/v1/organizations/${encodeURIComponent(organizationId)}/join-requests`, bearer);
    return validateCreateSuccess(data, organizationId);
  }

  async approve(bearer: string, organizationIdInput: string, requestIdInput: string) {
    const organizationId = validateId(organizationIdInput, 'INVALID_ORGANIZATION_ID');
    const requestId = validateId(requestIdInput, 'INVALID_REQUEST_ID');
    const data = await this.post(`/api/v1/organizations/${encodeURIComponent(organizationId)}/join-requests/${encodeURIComponent(requestId)}/approve`, bearer);
    return validateResolutionSuccess(data, organizationId, requestId, 'approve');
  }

  async reject(bearer: string, organizationIdInput: string, requestIdInput: string) {
    const organizationId = validateId(organizationIdInput, 'INVALID_ORGANIZATION_ID');
    const requestId = validateId(requestIdInput, 'INVALID_REQUEST_ID');
    const data = await this.post(`/api/v1/organizations/${encodeURIComponent(organizationId)}/join-requests/${encodeURIComponent(requestId)}/reject`, bearer);
    return validateResolutionSuccess(data, organizationId, requestId, 'reject');
  }
}

export { validateCreateSuccess, validateResolutionSuccess };
