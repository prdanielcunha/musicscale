/**
 * Read-only MusicScale integrity audit. Public CI: ONLY aggregate counters
 * may leave the runner. Never log/store organization IDs, user IDs, role
 * names, formation names, payloads, or private Firestore documents.
 *
 * Missing MusicScale roleId is not by itself data loss: historical member
 * profiles can use a tenant-bound role name and some members have no ministry
 * assignment. This audit makes NO writes or repair decisions.
 */
import { adminDb as db } from '../services/firebaseAdmin.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { collectVerifiedMinistryNameMatches } from '../utils/tenantMinistryAuditMatches.js';

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
function roleName(value: unknown): string {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function roleId(data: any): string {
  return clean(data?.roleId) || clean(data?.internalRoleId);
}
function tenantBound(data: any, orgId: string, uid: string): boolean {
  return (clean(data?.organizationId) || clean(data?.organization_id)) === orgId &&
    (clean(data?.uid) || clean(data?.userId) || clean(data?.user_id)) === uid;
}
function activeCohort(org: any, sub: any): boolean {
  const projected = sub?.apps?.musicscale;
  const app = org?.apps?.musicscale;
  const appStatus = clean(projected?.status || app?.status).toLowerCase();
  if (appStatus === 'active' || appStatus === 'trialing') return true;
  // Legacy MusicScale root subscription: no other app identity may qualify.
  return (!sub?.apps?.nestlocal || sub?.apps?.musicscale) &&
    (clean(sub?.app) === 'musicscale' ||
      (clean(sub?.stripeSubscriptionId) && !sub?.apps)) &&
    ['active', 'trialing'].includes(clean(sub?.status).toLowerCase());
}

async function main() {
  if (!db) throw Error('DB_UNAVAILABLE');
  const stats = {
    schemaVersion: 2, readOnly: true, personalDataExported: false,
    organizationsScanned: 0, organizationsWithActiveMusicScaleProjection: 0,
    organizationsWithFixedFormations: 0, membersScanned: 0,
    activeProjectionMembersScanned: 0,
    membersWithProjectionRoleId: 0, membersWithOtherTenantBoundRoleId: 0,
    membersResolvedByLegacyRoleName: 0,
    membersWithAmbiguousLegacyMinistryNames: 0,
    activeProjectionMembersWithAmbiguousLegacyMinistryNames: 0,
    membersWithNoIdentifiedMinistryRole: 0,
    membersWithConflictingRoleIds: 0, membersWithUnverifiedRoleId: 0,
    activeProjectionMembersWithNoIdentifiedMinistryRole: 0,
    activeProjectionMembersWithConflictingRoleIds: 0,
    fixedFormationsRoot: 0, fixedFormationsNested: 0,
    fixedFormationMemberAssignments: 0,
    fixedFormationsWithMissingTenant: 0,
    fixedFormationsForActiveProjection: 0,
  };
  const [organizations, roles, formations] = await Promise.all([
    db.collection('organizations').get(),
    db.collection('roles').get(),
    db.collectionGroup('fixedBandScales').get(),
  ]);
  const rolesByTenant = new Map<string, { ids: Set<string>; names: Map<string, string[]> }>();
  for (const role of roles.docs) {
    const data = role.data() || {};
    const orgId = clean(data.organizationId);
    if (!orgId) continue;
    if (!rolesByTenant.has(orgId)) rolesByTenant.set(orgId, { ids: new Set(), names: new Map() });
    const tenant = rolesByTenant.get(orgId)!;
    tenant.ids.add(role.id);
    const name = roleName(data.name);
    if (name) tenant.names.set(name, [...(tenant.names.get(name) || []), role.id]);
  }
  const activeOrgs = new Set<string>();
  const formationOrgs = new Set<string>();
  // One projection read per organization. No Stripe live billing assertions:
  // this is explicitly the canonical Firestore access projection only.
  const cohort = new Map<string, boolean>();
  for (const org of organizations.docs) {
    stats.organizationsScanned++;
    const id = org.id;
    const sub = await db.collection('subscriptions').doc(id).get();
    const active = activeCohort(org.data() || {}, sub.exists ? sub.data() || {} : {});
    cohort.set(id, active);
    if (active) { activeOrgs.add(id); stats.organizationsWithActiveMusicScaleProjection++; }
  }
  for (const formation of formations.docs) {
    const data = formation.data() || {};
    const orgId = clean(data.organizationId);
    if (!orgId) stats.fixedFormationsWithMissingTenant++;
    else {
      formationOrgs.add(orgId);
      if (activeOrgs.has(orgId)) stats.fixedFormationsForActiveProjection++;
    }
    if (formation.ref.parent.path === 'fixedBandScales') stats.fixedFormationsRoot++;
    else stats.fixedFormationsNested++;
    if (Array.isArray(data.assignments)) stats.fixedFormationMemberAssignments += data.assignments.length;
  }
  stats.organizationsWithFixedFormations = formationOrgs.size;
  for (const org of organizations.docs) {
    const id = org.id, active = cohort.get(id) === true;
    const members = await org.ref.collection('members').get();
    for (const member of members.docs) {
      const uid = member.id, canonical = member.data() || {};
      stats.membersScanned++;
      if (active) stats.activeProjectionMembersScanned++;
      const [projectionSnap, userSnap, aSnap, bSnap] = await Promise.all([
        org.ref.collection('musicscale_members').doc(uid).get(),
        db.collection('users').doc(uid).get(),
        db.collection('organization_members').doc(uid + '_' + id).get(),
        db.collection('organization_members').doc(id + '_' + uid).get(),
      ]);
      const projection = projectionSnap.exists ? projectionSnap.data() || {} : {};
      const user = userSnap.exists ? userSnap.data() || {} : {};
      const userBound = clean(user.organizationId) === id;
      const sources = [
        roleId(projection), roleId(canonical),
        ...[aSnap, bSnap].map(s => s.exists && tenantBound(s.data(), id, uid) ? roleId(s.data()) : ''),
        userBound ? roleId(user) : '',
      ].filter(Boolean);
      const unique = [...new Set(sources)];
      if (unique.length > 1) {
        stats.membersWithConflictingRoleIds++;
        if (active) stats.activeProjectionMembersWithConflictingRoleIds++;
      }
      const valid = rolesByTenant.get(id);
      const known = sources.find(r => valid?.ids.has(r)) || '';
      if (sources.length > 0 && !known) stats.membersWithUnverifiedRoleId++;
      if (known) {
        if (roleId(projection) && valid?.ids.has(roleId(projection))) stats.membersWithProjectionRoleId++;
        else stats.membersWithOtherTenantBoundRoleId++;
        continue;
      }
      // Compatibility evidence, never a mutation: historical MusicScale
      // profiles also stored ministryFunction as a string OR string array.
      // Never interpret canonical organization access role as a ministry role;
      // legacy user.role is usable only when that user profile is tenant-bound.
      const legacyMirrors = [aSnap, bSnap]
        .filter(s => s.exists && tenantBound(s.data(), id, uid))
        .map(s => s.data() || {});
      const legacyNames: unknown[] = [
        projection.musicscaleRole, projection.ministryFunction,
        canonical.musicscaleRole, canonical.ministryFunction,
        ...legacyMirrors.flatMap(m => [m.musicscaleRole, m.ministryFunction]),
        ...(userBound ? [user.musicscaleRole, user.ministryFunction, user.role] : []),
      ];
      const matches = collectVerifiedMinistryNameMatches(valid?.names, legacyNames);
      if (matches.length === 1) stats.membersResolvedByLegacyRoleName++;
      else {
        // More than one unique matching tenant role is ambiguous, not safe
        // evidence for an automatic assignment or a global role fallback.
        if (matches.length > 1) {
          stats.membersWithAmbiguousLegacyMinistryNames++;
          if (active) stats.activeProjectionMembersWithAmbiguousLegacyMinistryNames++;
        }
        stats.membersWithNoIdentifiedMinistryRole++;
        if (active) stats.activeProjectionMembersWithNoIdentifiedMinistryRole++;
      }
    }
  }
  await mkdir('tmp/firestore-audit', { recursive: true });
  await writeFile('tmp/firestore-audit/global-integrity-summary.json',
    JSON.stringify({ ...stats, generatedAt: new Date().toISOString() }, null, 2));
  console.log('GLOBAL_MUSICSCALE_INTEGRITY_AGGREGATE ' + JSON.stringify(stats));
}
main().catch(() => { console.error('GLOBAL_AUDIT_FAILED_WITHOUT_PERSONAL_DETAILS'); process.exitCode = 1; });
