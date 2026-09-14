import { hasEcosystemEntitlementRole } from '../effectiveEntitlements.js';

/** Read-only organization benefit, resolved after request authorization.
 * Owner identity comes from the existing organization contract, never actor role.
 */
export async function organizationHasEcosystemAccess(db: any, organizationId: string, orgData: any): Promise<boolean> {
  if (!organizationId || !orgData || orgData.archived === true || orgData.status === 'archived') return false;
  const ownerIds = [...new Set([orgData.ownerUid, orgData.ownerUserId, orgData.ownerId, orgData.owner_user_id])]
    .filter((uid): uid is string => typeof uid === 'string' && !!uid && !uid.includes('/'));
  for (const uid of ownerIds) {
    const profile = await db.collection('users').doc(uid).get();
    if (profile.exists && hasEcosystemEntitlementRole(profile.data())) return true;
  }
  return false;
}
