/**
 * Read-only, tenant-bound member directory compatibility.
 *
 * Canonical Hub membership remains authoritative, including explicit
 * removals/inactive status. Old root mirrors can add *only* independently
 * verified active members when no canonical record exists for their UID.
 * The tenant's verified owner may be shown even if their canonical membership
 * was not materialized by a historical checkout/onboarding flow.
 */
type Snapshot = { id: string; data(): any };
const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;
const active = (data: any, assumeLegacyStatus = false) =>
  ['active', 'ativo'].includes(String(data?.status || (assumeLegacyStatus ? '' : 'active')).trim().toLowerCase()) &&
  data?.disabled !== true && data?.removed !== true;

export function collectTenantMemberDirectoryCandidates(input: {
  organizationId: string;
  canonical: readonly Snapshot[];
  legacy: readonly Snapshot[];
  ownerUid?: string | null;
}): Snapshot[] {
  const { organizationId, canonical, legacy, ownerUid } = input;
  if (!VALID_ID.test(organizationId)) return [];
  const canonicalByUid = new Map(canonical.map(s => [s.id, s]));
  const results = new Map<string, Snapshot>();
  for (const member of canonical) {
    if (VALID_ID.test(member.id) && active(member.data()) &&
      (!member.data()?.organizationId || member.data()?.organizationId === organizationId)) {
      results.set(member.id, member);
    }
  }
  for (const mirror of legacy) {
    const data = mirror.data() || {};
    const uid = data.uid || data.userId || data.user_id;
    const tenant = data.organizationId || data.organization_id;
    if (typeof uid !== 'string' || !VALID_ID.test(uid) ||
        tenant !== organizationId || !active(data) || canonicalByUid.has(uid)) continue;
    results.set(uid, { id: uid, data: () => ({
      ...data,
      uid,
      organizationId,
    }) });
  }
  // Only an owner already independently verified from organizations/{id}
  // may be shown through this path. Never upgrade a revoked canonical record.
  if (ownerUid && VALID_ID.test(ownerUid) && !canonicalByUid.has(ownerUid)) {
    results.set(ownerUid, {
      id: ownerUid,
      data: () => ({ uid: ownerUid, organizationId, status: 'active', organizationRole: 'owner' }),
    });
  }
  return [...results.values()];
}
