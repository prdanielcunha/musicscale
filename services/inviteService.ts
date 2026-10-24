export interface Invite {
  id: string;
  organizationId: string;
  organizationName?: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  roleId: string;
  roleName: string;
  createdByUid: string;
  createdByName?: string;
  createdByEmail?: string;
  acceptedByUid?: string;
  acceptedAt?: any;
  createdAt: any;
  expiresAt: any;
  source: 'link' | 'whatsapp' | 'email' | 'manual';
  singleUse: boolean;
  token?: string; // transient
}

export const decodeToken = (token: string): { orgId: string, inviteId: string } | null => {
  try {
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const dec = atob(base64);
    const [orgId, inviteId] = dec.split(':');
    if (!orgId || !inviteId) return null;
    return { orgId, inviteId };
  } catch (e) {
    return null;
  }
};

export async function acceptInvite(idToken: string, token: string, organizationId?: string) {
  try {
    const response = await fetch('/api/orgs/accept-invite', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ token, ...(organizationId ? { organizationId } : {}) })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success !== true) {
      // Never expose proxy HTML, tokens or unsanitized server exceptions to the user.
      const code = typeof data?.reasonCode === 'string' ? data.reasonCode
        : typeof data?.error === 'string' ? data.error
        : response.ok ? 'INVALID_HUB_RESPONSE' : 'HUB_REQUEST_FAILED';
      return { success: false as const, message: code };
    }
    return data;
  } catch {
    return { success: false as const, message: 'NETWORK_ERROR' };
  }
}
