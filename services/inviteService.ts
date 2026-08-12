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

export async function acceptInvite(idToken: string, token: string) {
  const response = await fetch('/api/orgs/accept-invite', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ token })
  });
  const data = await response.json();
  if (!response.ok) return { success: false, message: data.reasonCode || data.error || 'error' };
  return data;
}
