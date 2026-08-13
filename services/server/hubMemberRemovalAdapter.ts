import { resolveHubOrigin } from './hubInvitationAdapter.js';

const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;
const VALID_SUCCESS_REASONS = new Set(['MEMBER_REMOVED', 'ALREADY_REMOVED']);

export class HubMemberRemovalError extends Error {
  constructor(public status: number, public reasonCode: string, public ambiguous = false) {
    super(reasonCode);
  }
}

function validOptionalId(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && VALID_ID.test(value));
}

function validateSuccess(data: any, organizationId: string, memberId: string) {
  const reasonCode = typeof data?.reasonCode === 'string' ? data.reasonCode.trim() : '';
  if (
    data?.success !== true ||
    !VALID_SUCCESS_REASONS.has(reasonCode) ||
    data?.organizationId !== organizationId ||
    data?.memberId !== memberId ||
    !validOptionalId(data?.activeOrganizationId ?? null) ||
    !validOptionalId(data?.primaryOrganizationId ?? null)
  ) {
    throw new HubMemberRemovalError(502, 'INVALID_HUB_RESPONSE', true);
  }
  return {
    success: true as const,
    reasonCode,
    organizationId,
    memberId,
    activeOrganizationId: data.activeOrganizationId ?? null,
    primaryOrganizationId: data.primaryOrganizationId ?? null
  };
}

export class HubMemberRemovalAdapter {
  constructor(private options: { origin?: string; fetch?: typeof fetch; timeoutMs?: number } = {}) {}

  async remove(bearer: string, organizationIdInput: string, memberIdInput: string) {
    if (typeof bearer !== 'string' || !bearer.startsWith('Bearer ') || bearer.length <= 7) {
      throw new HubMemberRemovalError(401, 'UNAUTHORIZED');
    }
    const organizationId = typeof organizationIdInput === 'string' ? organizationIdInput.trim() : '';
    const memberId = typeof memberIdInput === 'string' ? memberIdInput.trim() : '';
    if (!VALID_ID.test(organizationId) || !VALID_ID.test(memberId)) {
      throw new HubMemberRemovalError(400, 'INVALID_REQUEST_PATH');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 8000);
    try {
      const response = await (this.options.fetch || fetch)(
        `${resolveHubOrigin(this.options.origin)}/api/v1/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(memberId)}`,
        {
          method: 'DELETE',
          headers: { authorization: bearer },
          signal: controller.signal
        }
      );
      let data: any;
      try {
        data = await response.json();
      } catch {
        throw new HubMemberRemovalError(502, 'INVALID_HUB_RESPONSE', true);
      }
      if (!response.ok) {
        const reasonCode = String(data?.reasonCode || data?.error || 'HUB_REQUEST_FAILED');
        throw new HubMemberRemovalError(response.status, reasonCode, response.status >= 500);
      }
      return validateSuccess(data, organizationId, memberId);
    } catch (error) {
      if (error instanceof HubMemberRemovalError) throw error;
      throw new HubMemberRemovalError(503, 'HUB_UNAVAILABLE', true);
    } finally {
      clearTimeout(timer);
    }
  }
}

export { validateSuccess as validateHubMemberRemovalSuccess };
