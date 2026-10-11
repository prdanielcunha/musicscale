/**
 * Only canonical ecosystem roles may opt out of automatic Global Library curation.
 * Never use an organization membership role or a client-supplied admin boolean.
 */
export const GLOBAL_CURATION_OPTOUT_ROLES = new Set([
  'ceo', 'admin', 'global_admin', 'ecosystem_owner', 'founder', 'ecosystem_support'
]);

export function canOptOutOfGlobalCuration(userData: Record<string, unknown> | null | undefined): boolean {
  if (!userData) return false;
  return ['systemRole', 'ecosystemRole', 'globalRole'].some(field => {
    const value = userData[field];
    return typeof value === 'string' && GLOBAL_CURATION_OPTOUT_ROLES.has(value.trim().toLowerCase());
  });
}

/**
 * Opt-out authority is a server-only document written AFTER bearer-token
 * verification. A client-created song field never grants this exemption.
 */
export async function isVerifiedGlobalCurationOptOut(
  song: any, songId: string, db: any
): Promise<boolean> {
  if (song?.globalCurationOptOut !== true) return false;
  if (typeof songId !== 'string' || !songId.trim()) return false;
  const creatorUid = song?.createdBy?.uid;
  const orgId = song?.organizationId;
  if (!creatorUid || !orgId) return false;
  const record = await db.collection('globalCurationOptOuts').doc(songId).get();
  if (!record.exists) return false;
  const data = record.data() || {};
  return data.userId === creatorUid && data.organizationId === orgId;
}
