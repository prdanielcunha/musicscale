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

/** Default is mandatory inclusion; only a verified global actor can opt out. */
export async function isVerifiedGlobalCurationOptOut(song: any, db: any): Promise<boolean> {
  if (song?.globalCurationOptOut !== true) return false;
  const uid = song?.createdBy?.uid;
  if (typeof uid !== 'string' || !uid.trim()) return false;
  // Fail closed if the authoritative identity service is unavailable: do not
  // publish a song while the authorization of an opt-out request is unknown.
  const snapshot = await db.collection('users').doc(uid).get();
  return snapshot.exists && canOptOutOfGlobalCuration(snapshot.data());
}
