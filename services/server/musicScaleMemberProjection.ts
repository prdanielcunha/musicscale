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

export interface MusicScaleMemberWriteOptions {
  source?: string;
}

export interface MemberDirectoryMusicProfile {
  roleId: string;
  musicscaleRole: string;
  ministryFunction: string | string[] | null;
  specialtyIds: string[];
  legacyUserFallbackAllowed: boolean;
}

const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;
const VALID_WRITE_SOURCES = new Set([
  'member_profile_update',
  'hub_invitation_role_intent',
  'legacy_root_invite_migration',
  'legacy_nested_invite_migration'
]);

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

function cleanStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return [...new Set(
    value
      .filter((item: unknown) => typeof item === 'string')
      .map((item: string) => item.trim())
      .filter(Boolean)
  )];
}

/**
 * Restores the legacy MusicScale profile shape used before the canonical
 * organization member-directory migration, without crossing tenant boundaries.
 *
 * Historic MusicScale member metadata lived in users/{uid} and was only read
 * through a query constrained by users.organizationId == active organization.
 * The canonical directory may safely use that same legacy source only when the
 * stored organizationId still matches the organization being requested.
 *
 * Explicit projection/member fields always win. An explicit empty
 * specialtyIds array remains authoritative and is never replaced by legacy
 * data.
 */
export function resolveMemberDirectoryMusicProfile(
  projectionData: any,
  memberData: any,
  userData: any,
  organizationId: string
): MemberDirectoryMusicProfile {
  const legacyUserFallbackAllowed = cleanString(userData?.organizationId) === organizationId;
  const legacyUserData = legacyUserFallbackAllowed ? (userData || {}) : {};

  const roleId =
    cleanString(projectionData?.roleId) ||
    cleanString(projectionData?.internalRoleId) ||
    cleanString(memberData?.roleId) ||
    cleanString(memberData?.internalRoleId) ||
    '';

  // memberData.role is the canonical organization-access role and must never
  // become a MusicScale ministry role. The generic legacy `role` fallback is
  // accepted only from the historically tenant-bound users/{uid} profile.
  const musicscaleRole =
    cleanString(projectionData?.musicscaleRole) ||
    cleanString(memberData?.musicscaleRole) ||
    cleanString(legacyUserData?.musicscaleRole) ||
    cleanString(legacyUserData?.role) ||
    '';

  const ministryFunction =
    projectionData?.ministryFunction ??
    memberData?.ministryFunction ??
    legacyUserData?.ministryFunction ??
    null;

  const specialtyIds =
    cleanStringArray(projectionData?.specialtyIds) ??
    cleanStringArray(memberData?.specialtyIds) ??
    cleanStringArray(legacyUserData?.specialtyIds) ??
    [];

  return {
    roleId,
    musicscaleRole,
    ministryFunction,
    specialtyIds,
    legacyUserFallbackAllowed,
  };
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
  input: any,
  options: MusicScaleMemberWriteOptions = {}
): Promise<void> {
  assertMusicScaleMemberIdentity(organizationId, uid);
  if (!VALID_ID.test(actorUid)) throw new Error('INVALID_ACTOR_ID');
  const patch = sanitizeMusicScaleMemberPatch(input);
  if (patch.roleId) await validateMusicScaleRole(db, organizationId, String(patch.roleId));
  const requestedSource = cleanString(options.source) || 'member_profile_update';
  const source = VALID_WRITE_SOURCES.has(requestedSource) ? requestedSource : 'member_profile_update';
  await db.collection('organizations').doc(organizationId).collection('musicscale_members').doc(uid).set({
    uid,
    organizationId,
    ...patch,
    updatedAt: new Date(),
    updatedByUid: actorUid,
    source
  }, { merge: true });
}
