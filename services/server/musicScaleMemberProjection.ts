export const MUSIC_SCALE_MEMBER_FIELDS = [
  'roleId',
  'musicscaleRole',
  'ministryFunction',
  'specialtyIds'
] as const;

export type MusicScaleMemberSource =
  | 'projection'
  | 'legacy_canonical_membership'
  | 'legacy_membership_mirror'
  | 'none';

export interface ResolvedMusicScaleMemberProfile {
  roleId: string | null;
  musicscaleRole?: string;
  ministryFunction?: string | string[];
  specialtyIds?: string[];
  source: MusicScaleMemberSource;
}

const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  return clean || undefined;
}

function profileFrom(data: any, source: MusicScaleMemberSource): ResolvedMusicScaleMemberProfile {
  const roleId = cleanString(data?.roleId) || cleanString(data?.internalRoleId) || null;
  const musicscaleRole = cleanString(data?.musicscaleRole);
  const ministryFunction = typeof data?.ministryFunction === 'string'
    ? cleanString(data.ministryFunction)
    : Array.isArray(data?.ministryFunction)
      ? data.ministryFunction.filter((item: unknown) => typeof item === 'string' && item.trim()).map((item: string) => item.trim())
      : undefined;
  const specialtyIds = Array.isArray(data?.specialtyIds)
    ? data.specialtyIds.filter((item: unknown) => typeof item === 'string' && item.trim()).map((item: string) => item.trim())
    : undefined;
  return { roleId, musicscaleRole, ministryFunction, specialtyIds, source };
}

export function assertMusicScaleMemberIdentity(organizationId: string, uid: string): void {
  if (!VALID_ID.test(organizationId)) throw new Error('INVALID_ORGANIZATION_ID');
  if (!VALID_ID.test(uid)) throw new Error('INVALID_USER_ID');
}

export async function resolveMusicScaleMemberProfile(
  db: any,
  organizationId: string,
  uid: string,
  canonicalMembershipData?: any
): Promise<ResolvedMusicScaleMemberProfile> {
  assertMusicScaleMemberIdentity(organizationId, uid);
  const projection = await db.collection('organizations').doc(organizationId)
    .collection('musicscale_members').doc(uid).get();
  if (projection.exists) return profileFrom(projection.data(), 'projection');

  if (canonicalMembershipData && (cleanString(canonicalMembershipData.roleId) || cleanString(canonicalMembershipData.internalRoleId))) {
    return profileFrom(canonicalMembershipData, 'legacy_canonical_membership');
  }

  for (const id of [`${uid}_${organizationId}`, `${organizationId}_${uid}`]) {
    const legacy = await db.collection('organization_members').doc(id).get();
    if (!legacy.exists) continue;
    const data = legacy.data();
    const boundOrg = cleanString(data?.organizationId) || cleanString(data?.organization_id);
    const boundUid = cleanString(data?.uid) || cleanString(data?.userId) || cleanString(data?.user_id);
    if (boundOrg === organizationId && boundUid === uid) {
      return profileFrom(data, 'legacy_membership_mirror');
    }
  }
  return { roleId: null, source: 'none' };
}

export async function validateMusicScaleRole(db: any, organizationId: string, roleId: string): Promise<any> {
  const cleanRoleId = cleanString(roleId);
  if (!cleanRoleId || !VALID_ID.test(cleanRoleId)) throw new Error('INVALID_ROLE_ID');
  const role = await db.collection('roles').doc(cleanRoleId).get();
  if (!role.exists) throw new Error('ROLE_NOT_FOUND');
  const data = role.data();
  if (data?.organizationId !== organizationId) throw new Error('ROLE_ORGANIZATION_MISMATCH');
  return data;
}

export function sanitizeMusicScaleMemberPatch(input: any): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  const roleId = cleanString(input?.roleId);
  const musicscaleRole = cleanString(input?.musicscaleRole);
  if (roleId) output.roleId = roleId;
  if (musicscaleRole) output.musicscaleRole = musicscaleRole;
  if (typeof input?.ministryFunction === 'string') output.ministryFunction = cleanString(input.ministryFunction) || '';
  if (Array.isArray(input?.ministryFunction)) output.ministryFunction = profileFrom(input, 'projection').ministryFunction || [];
  if (Array.isArray(input?.specialtyIds)) output.specialtyIds = profileFrom(input, 'projection').specialtyIds || [];
  return output;
}

export async function writeMusicScaleMemberProjection(
  db: any,
  organizationId: string,
  uid: string,
  actorUid: string,
  input: any
): Promise<void> {
  assertMusicScaleMemberIdentity(organizationId, uid);
  const patch = sanitizeMusicScaleMemberPatch(input);
  if (patch.roleId) await validateMusicScaleRole(db, organizationId, String(patch.roleId));
  await db.collection('organizations').doc(organizationId).collection('musicscale_members').doc(uid).set({
    uid,
    organizationId,
    ...patch,
    updatedAt: new Date(),
    updatedByUid: actorUid,
    source: 'member_profile_update'
  }, { merge: true });
}
