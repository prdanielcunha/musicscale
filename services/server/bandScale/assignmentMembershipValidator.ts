/**
 * Scale assignment eligibility is based on tenant membership, not the user's
 * mutable / historically single-org default users.organizationId.
 *
 * A canonical membership record is authoritative: its explicit inactive or
 * removed status must never be bypassed by an old user profile.
 */
const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;
const ACTIVE = new Set(['active', 'ativo']);

function activeMember(data: any): boolean {
  return ACTIVE.has(String(data?.status || '').trim().toLowerCase())
    && data?.disabled !== true && data?.removed !== true;
}

function legacyBound(data: any, uid: string, orgId: string): boolean {
  const organizationId = data?.organizationId || data?.organization_id;
  const memberId = data?.uid || data?.userId || data?.user_id;
  return organizationId === orgId && memberId === uid;
}

export async function validateBandScaleAssignedUsers(
  db: any, userIds: readonly string[], organizationId: string,
): Promise<void> {
  if (!db) throw new Error('Banco de dados não disponível.');
  if (!VALID_ID.test(organizationId)) throw new Error('Organização inválida.');
  const unique = [...new Set(userIds)];
  if (unique.some(id => !VALID_ID.test(id))) {
    throw new Error('Identificador de integrante inválido.');
  }

  await Promise.all(unique.map(async uid => {
    const [user, canonical] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('organizations').doc(organizationId)
        .collection('members').doc(uid).get(),
    ]);
    if (!user.exists || user.data()?.disabled === true) {
      throw new Error('Integrante não encontrado ou desativado.');
    }

    if (canonical.exists) {
      const data = canonical.data() || {};
      // A corrupted cross-tenant record must not be considered valid.
      if ((data.organizationId && data.organizationId !== organizationId) ||
          !activeMember(data)) {
        throw new Error('Integrante não possui associação ativa com esta organização.');
      }
      return;
    }

    // Temporary compatibility for memberships that predate the Hub migration.
    // Only explicitly tenant-bound, active legacy records are sufficient.
    const [legacyA, legacyB] = await Promise.all([
      db.collection('organization_members').doc(uid + '_' + organizationId).get(),
      db.collection('organization_members').doc(organizationId + '_' + uid).get(),
    ]);
    for (const legacy of [legacyA, legacyB]) {
      if (!legacy.exists) continue;
      if (legacyBound(legacy.data(), uid, organizationId) &&
          activeMember(legacy.data())) return;
      // Never fall through to the profile if an explicit record is disabled.
      if (legacyBound(legacy.data(), uid, organizationId)) {
        throw new Error('Integrante não possui associação ativa com esta organização.');
      }
    }

    // Historic MusicScale deployments stored only users.organizationId.
    // Keep that exact binding for legacy tenants, never mutable activeOrg.
    const data = user.data() || {};
    if (data.organizationId === organizationId &&
        !['disabled', 'inactive', 'removed', 'suspended'].includes(
          String(data.status || '').toLowerCase())) return;

    // An owner may predate members/{uid} materialization. Ownership must be
    // proven by the *requested tenant document*, not by a user profile or
    // a caller-supplied role. Explicitly inactive canonical/legacy records
    // above still fail closed before reaching this fallback.
    const orgSnap = await db.collection('organizations').doc(organizationId).get();
    if (orgSnap.exists) {
      const org = orgSnap.data() || {};
      const orgState = String(org.status || '').trim().toLowerCase();
      if (org.disabled !== true && org.archived !== true &&
          !['disabled', 'suspended', 'archived'].includes(orgState) &&
          [org.ownerUid, org.ownerUserId, org.ownerId].includes(uid)) return;
    }

    throw new Error('Integrante não pertence a esta organização.');
  }));
}
