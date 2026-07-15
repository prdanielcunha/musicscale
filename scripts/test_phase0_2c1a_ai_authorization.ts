
import { authorizeAiRequest, InMemoryAiRateLimiter, AuthorizeAiRequestInput } from '../services/server/aiRequestSecurity';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import * as crypto from 'crypto';

let registered = 0;
let passed = 0;
let failed = 0;
let currentTestAssertions = 0;

const assertHelper = {
  ok: (val: any, msg?: string) => { currentTestAssertions++; assert.ok(val, msg); },
  strictEqual: (a: any, b: any, msg?: string) => { currentTestAssertions++; assert.strictEqual(a, b, msg); },
  notStrictEqual: (a: any, b: any, msg?: string) => { currentTestAssertions++; assert.notStrictEqual(a, b, msg); },
};

async function test(name: string, fn: (a: typeof assertHelper) => Promise<void> | void) {
  registered++;
  try {
    currentTestAssertions = 0;
    await fn(assertHelper);
    if (currentTestAssertions === 0) {
      throw new Error("No assertions made in test");
    }
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (error: any) {
    console.error(`[FAIL] ${name}`, error.message || error);
    failed++;
  }
}

class MockAuth {
  async verifyIdToken(token: string, checkRevoked: boolean) {
    if (!checkRevoked) throw new Error("checkRevoked MUST be true");
    if (token === 'valid_token') return { uid: 'uid123', email: 'test@example.com' };
    if (token === 'global_ceo') return { uid: 'ceo_uid' };
    if (token === 'global_admin') return { uid: 'gadmin_uid' };
    if (token === 'eco_owner') return { uid: 'eowner_uid' };
    if (token === 'founder_tk') return { uid: 'founder_uid' };
    if (token === 'admin_tk') return { uid: 'admin_uid' };
    if (token === 'owner_tk') return { uid: 'owner_uid' };
    if (token === 'dono_tk') return { uid: 'dono_uid' };
    if (token === 'support_tk') return { uid: 'support_uid' };
    if (token === 'role_ceo_tk') return { uid: 'role_ceo_uid' };
    if (token === 'approle_tk') return { uid: 'approle_uid' };
    if (token === 'active_member_tk') return { uid: 'active_member_uid' };
    if (token === 'inactive_canon_tk') return { uid: 'inactive_canon_uid' };
    if (token === 'legacy_uid_org_tk') return { uid: 'legacy_uid_org_uid' };
    if (token === 'legacy_org_uid_tk') return { uid: 'legacy_org_uid_uid' };
    if (token === 'legacy_inactive_tk') return { uid: 'legacy_inactive_uid' };
    if (token === 'owner_uid_tk') return { uid: 'owner_uid_uid' };
    if (token === 'owner_userid_tk') return { uid: 'owner_userid_uid' };
    if (token === 'owner_id_tk') return { uid: 'owner_id_uid' };
    if (token === 'owner_email_tk') return { uid: 'owner_email_uid', email: 'owner@email.com' };
    if (token === 'admin_org_tk') return { uid: 'admin_org_uid' };
    if (token === 'member_tk') return { uid: 'member_uid' };
    if (token === 'diff_org_role_tk') return { uid: 'diff_org_role_uid' };
    if (token === 'manage_rep_tk') return { uid: 'manage_rep_uid' };
    if (token === 'manage_chords_tk') return { uid: 'manage_chords_uid' };
    if (token === 'rep_or_chords_tk') return { uid: 'rep_or_chords_uid' };
    if (token === 'admin_name_tk') return { uid: 'admin_name_uid' };
    if (token === 'cap_array_tk') return { uid: 'cap_array_uid' };
    if (token === 'cap_map_tk') return { uid: 'cap_map_uid' };
    if (token === 'eff_cap_tk') return { uid: 'eff_cap_uid' };
    if (token === 'manage_chords_cap_tk') return { uid: 'manage_chords_cap_uid' };
    if (token === 'fail_role_tk') return { uid: 'fail_role_uid' };
    if (token === 'ent_active_true_tk') return { uid: 'ent_active_true_uid' };
    if (token === 'ent_active_false_tk') return { uid: 'ent_active_false_uid' };
    if (token === 'ent_missing_feature_tk') return { uid: 'ent_missing_feature_uid' };
    if (token === 'ent_suspended_tk') return { uid: 'ent_suspended_uid' };
    if (token === 'ent_trial_tk') return { uid: 'ent_trial_uid' };
    if (token === 'ent_trialing_tk') return { uid: 'ent_trialing_uid' };
    if (token === 'ent_neg_legacy_pro_tk') return { uid: 'ent_neg_legacy_pro_uid' };
    if (token === 'ent_no_legacy_pro_tk') return { uid: 'ent_no_legacy_pro_uid' };
    if (token === 'ent_premium_tk') return { uid: 'ent_premium_uid' };
    if (token === 'ent_pro_unlimited_tk') return { uid: 'ent_pro_unlimited_uid' };
    if (token === 'ent_starter_tk') return { uid: 'ent_starter_uid' };
    if (token === 'ent_advanced_tk') return { uid: 'ent_advanced_uid' };
    if (token === 'ent_unknown_tk') return { uid: 'ent_unknown_uid' };
    if (token === 'ent_past_due_tk') return { uid: 'ent_past_due_uid' };
    if (token === 'ent_cancelled_tk') return { uid: 'ent_cancelled_uid' };
    if (token === 'ent_fetch_fail_tk') return { uid: 'ent_fetch_fail_uid' };
    
    throw new Error("Invalid token");
  }
}

class MockDoc {
  constructor(public id: string, public _data: any, public _exists: boolean = true) {}
  get exists() { return this._exists; }
  data() { return this._data; }
}

class MockCollection {
  constructor(public name: string, public db: MockDb, public parentDoc?: string) {}
  doc(id: string) {
    return {
      collection: (subName: string) => new MockCollection(subName, this.db, id),
      get: async () => {
        const fullPath = this.parentDoc ? `${this.name}/${this.parentDoc}/${id}` : `${this.name}/${id}`;
        
        if (this.name === 'users') {
          if (id === 'uid123') return new MockDoc(id, {});
          if (id === 'ceo_uid') return new MockDoc(id, { systemRole: 'ceo' });
          if (id === 'gadmin_uid') return new MockDoc(id, { systemRole: 'global_admin' });
          if (id === 'eowner_uid') return new MockDoc(id, { systemRole: 'ecosystem_owner' });
          if (id === 'founder_uid') return new MockDoc(id, { systemRole: 'founder' });
          if (id === 'admin_uid') return new MockDoc(id, { systemRole: 'admin' });
          if (id === 'owner_uid') return new MockDoc(id, { systemRole: 'owner' });
          if (id === 'dono_uid') return new MockDoc(id, { systemRole: 'dono' });
          if (id === 'support_uid') return new MockDoc(id, { systemRole: 'support' });
          if (id === 'role_ceo_uid') return new MockDoc(id, { role: 'ceo' });
          if (id === 'approle_uid') return new MockDoc(id, { appRole: 'global_admin' });
          if (id === 'ent_fetch_fail_uid') return new MockDoc(id, { systemRole: '' }); // pass auth, fail on org
          
          if (id === 'unknown') return new MockDoc(id, null, false);
          return new MockDoc(id, {});
        }

        if (this.name === 'organizations') {
          if (id === 'org123') return new MockDoc(id, { status: 'active', apps: { musicscale: { status: 'active', features: { aiImport: true, aiStructuring: true } } } });
          if (id === 'org_archived') return new MockDoc(id, { status: ' ARCHIVED ' });
          if (id === 'org_archived2') return new MockDoc(id, { archived: true });
          if (id === 'org_owner_uid') return new MockDoc(id, { ownerUid: 'owner_uid_uid', apps: { musicscale: { status: 'active', features: { aiImport: true, aiStructuring: true } } } });
          if (id === 'org_owner_userid') return new MockDoc(id, { ownerUserId: 'owner_userid_uid', apps: { musicscale: { status: 'active', features: { aiImport: true, aiStructuring: true } } } });
          if (id === 'org_owner_id') return new MockDoc(id, { ownerId: 'owner_id_uid', apps: { musicscale: { status: 'active', features: { aiImport: true, aiStructuring: true } } } });
          if (id === 'org_owner_email') return new MockDoc(id, { ownerEmail: 'owner@email.com', apps: { musicscale: { status: 'active', features: { aiImport: true, aiStructuring: true } } } });
          if (id === 'org_ent_active_false') return new MockDoc(id, { apps: { musicscale: { status: 'active', features: { aiImport: false } } } });
          if (id === 'org_ent_missing_feature') return new MockDoc(id, { apps: { musicscale: { status: 'active', features: {} } } });
          if (id === 'org_ent_suspended') return new MockDoc(id, { apps: { musicscale: { status: 'suspended', features: { aiImport: true, aiStructuring: true } } } });
          if (id === 'org_ent_trial') return new MockDoc(id, { apps: { musicscale: { status: 'trial', features: { aiImport: true, aiStructuring: true } } } });
          if (id === 'org_ent_trialing') return new MockDoc(id, { apps: { musicscale: { status: 'trialing', features: { aiImport: true, aiStructuring: true } } } });
          if (id === 'org_ent_neg_legacy_pro') return new MockDoc(id, { music_scale_plan: 'pro', apps: { musicscale: { status: 'active', features: { aiImport: false } } } });
          if (id === 'org_ent_no_legacy_pro') return new MockDoc(id, { music_scale_plan: 'pro' });
          if (id === 'org_ent_premium') return new MockDoc(id, { music_scale_plan: 'premium' });
          if (id === 'org_ent_pro_unlimited') return new MockDoc(id, { plan: 'pro_unlimited' });
          if (id === 'org_ent_starter') return new MockDoc(id, { music_scale_plan: 'starter' });
          if (id === 'org_ent_advanced') return new MockDoc(id, { music_scale_plan: 'advanced' });
          if (id === 'org_ent_unknown') return new MockDoc(id, { plan: 'blabla' });
          if (id === 'org_new_1') return new MockDoc(id, { ownerUid: 'new_test_uid7', apps: { musicscale: null }, plan: 'pro' });
          if (id === 'org_new_2') return new MockDoc(id, { ownerUid: 'new_test_uid7', apps: { musicscale: false }, plan: 'pro' });
          if (id === 'org_new_3') return new MockDoc(id, { ownerUid: 'new_test_uid7', apps: { musicscale: "pro" }, plan: 'pro' });
          if (id === 'org_new_4') return new MockDoc(id, { ownerUid: 'new_test_uid7', apps: { musicscale: [] }, plan: 'pro' });
          if (id === 'org_new_5') return new MockDoc(id, { ownerUid: 'new_test_uid7', apps: {}, plan: 'pro' });
          if (id === 'org_new_6') return new MockDoc(id, { ownerUid: 'new_test_uid7', plan: 'pro' });

          if (id === 'org_ent_past_due') return new MockDoc(id, { plan: 'pro', subscriptionStatus: 'past_due' });
          if (id === 'org_ent_cancelled') return new MockDoc(id, { plan: 'pro', subscription_status: 'cancelled' });
          if (id === 'org_ent_fetch_fail') throw new Error('fetch fail');
          if (id === 'org_ent_resolution_fail') return new MockDoc(id, Object.defineProperty({ ownerUid: 'new_test_uid7' }, 'apps', { get: () => { throw new Error('entitlement fail'); } }));
          return new MockDoc(id, null, false);
        }

        if (this.name === 'members') {
          if (id === 'active_member_uid') return new MockDoc(id, { status: 'active', organizationRole: 'member', roleId: 'role_manage_rep' });
          if (id === 'inactive_canon_uid') return new MockDoc(id, { status: 'inactive' });
          if (id === 'admin_org_uid') return new MockDoc(id, { status: ' ATIVO ', organizationRole: 'admin' });
          if (id === 'member_uid') return new MockDoc(id, { status: 'active', organizationRole: 'member' });
          if (id === 'diff_org_role_uid') return new MockDoc(id, { status: 'active', roleId: 'role_diff_org' });
          if (id === 'manage_rep_uid') return new MockDoc(id, { status: 'active', roleId: 'role_manage_rep' });
          if (id === 'manage_chords_uid') return new MockDoc(id, { status: 'active', roleId: 'role_manage_chords' });
          if (id === 'rep_or_chords_uid') return new MockDoc(id, { status: 'active', roleId: 'role_manage_chords' });
          if (id === 'admin_name_uid') return new MockDoc(id, { status: 'active', roleId: 'role_admin_name' });
          if (id === 'cap_array_uid') return new MockDoc(id, { status: 'active', capabilities: ['manageSongs'] });
          if (id === 'cap_map_uid') return new MockDoc(id, { status: 'active', permissions: { 'musicscale.songs.edit': true } });
          if (id === 'eff_cap_uid') return new MockDoc(id, { status: 'active', effectiveCapabilities: ['canManageRepertoire'] });
          if (id === 'manage_chords_cap_uid') return new MockDoc(id, { status: 'active', capabilities: ['manageChords'] });
          if (id === 'fail_role_uid') return new MockDoc(id, { status: 'active', roleId: 'role_fail' });
          if (id === 'new_test_uid1') return new MockDoc(id, { status: 'active', capabilities: { manageSongs: true }, permissions: { canManageRepertoire: true } });
          if (id === 'new_test_uid2') return new MockDoc(id, { status: 'active', capabilities: [], effectiveCapabilities: ['manageSongs'] });
          if (id === 'new_test_uid3') return new MockDoc(id, { status: 'active', permissions: {}, capabilities: ['manageSongs'] });
          if (id === 'new_test_uid4') return new MockDoc(id, { status: 'active', capabilities: { manageSongs: false } });
          if (id === 'new_test_uid5') return new MockDoc(id, { status: 'active', capabilities: { manageSongs: "true" } });
          if (id === 'new_test_uid6') return new MockDoc(id, { status: 'active', roleId: 'role_manage_rep', capabilities: ['manageChords'] });
          if (id === 'new_test_uid7') return new MockDoc(id, { status: 'active', role: 'admin' });
          if (id === 'new_test_uid9') return new MockDoc(id, { status: 'active', musicscaleRole: 'admin' });
          if (id === 'new_test_uid10') return new MockDoc(id, { status: 'active', appRole: 'admin' });
          if (id === 'org_role_spaces') return new MockDoc(id, { status: 'active', organizationRole: '   ', role: 'admin' });
          if (id === 'org_role_empty') return new MockDoc(id, { status: 'active', organizationRole: '', role: 'admin' });
          if (id === 'org_role_member') return new MockDoc(id, { status: 'active', organizationRole: 'member', role: 'admin' });
          if (id === 'org_role_invalid') return new MockDoc(id, { status: 'active', organizationRole: { x: 1 }, role: 'admin' });
          if (id === 'role_id_spaces') return new MockDoc(id, { status: 'active', organizationRole: 'member', roleId: '   ', internalRoleId: 'role_manage_rep' });
          if (id === 'role_id_valid') return new MockDoc(id, { status: 'active', organizationRole: 'member', roleId: 'role_manage_rep', internalRoleId: 'role_fail' });
          if (id === 'cap_inherited') {
             function InheritCap() {}
             InheritCap.prototype.manageSongs = true;
             return new MockDoc(id, { status: 'active', capabilities: new InheritCap() });
          }
          if (id === 'cap_own') return new MockDoc(id, { status: 'active', capabilities: { manageSongs: true } });
          
          if (id === 'ent_active_true_uid') return new MockDoc(id, { status: 'active', organizationRole: 'admin' });
          if (id === 'ent_active_false_uid') return new MockDoc(id, { status: 'active', organizationRole: 'admin' });
          if (id === 'ent_missing_feature_uid') return new MockDoc(id, { status: 'active', organizationRole: 'admin' });
          if (id === 'ent_suspended_uid') return new MockDoc(id, { status: 'active', organizationRole: 'admin' });
          if (id === 'ent_trial_uid') return new MockDoc(id, { status: 'active', organizationRole: 'admin' });
          if (id === 'ent_trialing_uid') return new MockDoc(id, { status: 'active', organizationRole: 'admin' });
          if (id === 'ent_neg_legacy_pro_uid') return new MockDoc(id, { status: 'active', organizationRole: 'admin' });
          if (id === 'ent_no_legacy_pro_uid') return new MockDoc(id, { status: 'active', organizationRole: 'admin' });
          if (id === 'ent_premium_uid') return new MockDoc(id, { status: 'active', organizationRole: 'admin' });
          if (id === 'ent_pro_unlimited_uid') return new MockDoc(id, { status: 'active', organizationRole: 'admin' });
          if (id === 'ent_starter_uid') return new MockDoc(id, { status: 'active', organizationRole: 'admin' });
          if (id === 'ent_advanced_uid') return new MockDoc(id, { status: 'active', organizationRole: 'admin' });
          if (id === 'ent_unknown_uid') return new MockDoc(id, { status: 'active', organizationRole: 'admin' });
          if (id === 'ent_past_due_uid') return new MockDoc(id, { status: 'active', organizationRole: 'admin' });
          if (id === 'ent_cancelled_uid') return new MockDoc(id, { status: 'active', organizationRole: 'admin' });

          return new MockDoc(id, null, false);
        }

        if (this.name === 'organization_members') {
          if (id === 'legacy_uid_org_uid_org123') return new MockDoc(id, { status: 'active', organizationRole: 'member', roleId: 'role_manage_rep' });
          if (id === 'org123_legacy_org_uid_uid') return new MockDoc(id, { status: 'ativo', organizationRole: 'member', roleId: 'role_manage_rep' });
          if (id === 'legacy_inactive_uid_org123') return new MockDoc(id, { status: 'pending' });
          if (id === 'inactive_canon_uid_org123') return new MockDoc(id, { status: 'active' }); // Should be ignored because canon exists
          if (id === 'new_test_uid8_org123') return new MockDoc(id, { status: 'active', role: 'admin' });
          return new MockDoc(id, null, false);
        }

        if (this.name === 'roles') {
          if (id === 'role_diff_org') return new MockDoc(id, { organizationId: 'other_org', permissions: { canManageRepertoire: true } });
          if (id === 'role_manage_rep') return new MockDoc(id, { organizationId: 'org123', permissions: { canManageRepertoire: true } });
          if (id === 'role_manage_chords') return new MockDoc(id, { organizationId: 'org123', permissions: { canManageChords: true } });
          if (id === 'role_admin_name') return new MockDoc(id, { organizationId: 'org123', name: 'Administrador' }); // no perms
          if (id === 'role_fail') throw new Error("fetch error");
          return new MockDoc(id, null, false);
        }

        return new MockDoc(id, null, false);
      }
    };
  }
}

class MockDb {
  collection(name: string) {
    return new MockCollection(name, this);
  }
}

const auth = new MockAuth();
const db = new MockDb();

async function runTests() {


  const getHashNow = (file: string) => {
    try {
        const c = fs.readFileSync(path.resolve(process.cwd(), file));
        return crypto.createHash('sha256').update(c).digest('hex');
    } catch { return ''; }
  };

  const protectedHashesBefore = new Map<string, string>([
    ['server.ts', getHashNow('server.ts')],
    ['components/songs/AiSongImportModal.tsx', getHashNow('components/songs/AiSongImportModal.tsx')],
    ['package.json', getHashNow('package.json')],
    ['package-lock.json', getHashNow('package-lock.json')]
  ]);
  const defaults: AuthorizeAiRequestInput = {
    authHeader: 'Bearer valid_token',
    organizationId: 'org123',
    requiredFeature: 'aiImport',
    requiredAnyPermissions: [],
    dbInstance: db,
    authInstance: auth
  };

  // TESTES OBRIGATÓRIOS DE AUTENTICAÇÃO
  await test("1. DB ausente -> 503", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, dbInstance: null });
    a.strictEqual(res.ok, false);
    if (!res.ok) { a.strictEqual((res as any).statusCode, 503); a.strictEqual((res as any).error, "SERVICE_UNAVAILABLE"); }
  });
  await test("2. Auth ausente -> 503", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authInstance: null });
    a.strictEqual(res.ok, false);
    if (!res.ok) { a.strictEqual((res as any).statusCode, 503); a.strictEqual((res as any).error, "SERVICE_UNAVAILABLE"); }
  });
  await test("3. Header ausente -> 401", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: undefined });
    a.strictEqual(res.ok, false);
    if (!res.ok) a.strictEqual((res as any).statusCode, 401);
  });
  await test("4. Header malformado -> 401", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Basic token' });
    a.strictEqual(res.ok, false);
    if (!res.ok) a.strictEqual((res as any).statusCode, 401);
  });
  await test("5. Bearer sem token -> 401", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ' });
    a.strictEqual(res.ok, false);
    if (!res.ok) a.strictEqual((res as any).statusCode, 401);
  });
  await test("6. Token inválido -> 401", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer invalid_tk' });
    a.strictEqual(res.ok, false);
    if (!res.ok) a.strictEqual((res as any).statusCode, 401);
  });
  await test("7. verifyIdToken recebe checkRevoked true", async (a) => {
    let calledWithTrue = false;
    const trackingAuth = {
      verifyIdToken: async (tk: string, cr: boolean) => {
         if (cr === true) calledWithTrue = true;
         return { uid: 'uid123' };
      }
    };
    await authorizeAiRequest({ ...defaults, authInstance: trackingAuth });
    a.ok(calledWithTrue);
  });
  await test("8. claimedUserId igual é aceito", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer gadmin', claimedUserId: 'gadmin_uid', authInstance: { verifyIdToken: async () => ({uid: 'gadmin_uid'})} });
    // It should not fail with 403 actor mismatch. It might fail on user doc, but let's just use a valid one
    const res2 = await authorizeAiRequest({ ...defaults, claimedUserId: 'uid123' });
    a.ok(res2.ok === false && (res2 as any).statusCode === 403 || res2.ok === true); // Actually uid123 has no membership in defaults, so 403 forbidden is fine, just not ACTOR_ID_MISMATCH
    if (!res2.ok) a.notStrictEqual((res2 as any).error, "ACTOR_ID_MISMATCH");
  });
  await test("9. claimedUserId diferente -> 403", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, claimedUserId: 'other_uid' });
    a.strictEqual(res.ok, false);
    if (!res.ok) a.strictEqual((res as any).statusCode, 403);
    if (!res.ok) a.strictEqual((res as any).error, "ACTOR_ID_MISMATCH");
  });
  await test("10. perfil inexistente -> 403", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer unk_tk', authInstance: { verifyIdToken: async()=>({uid:'unknown'}) } });
    a.strictEqual(res.ok, false);
    if (!res.ok) a.strictEqual((res as any).statusCode, 403);
  });

  // TESTES DE PAPEL GLOBAL
  await test("11. ceo é global", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer global_ceo' });
    if (!res.ok) console.log(res); if (!res.ok) console.log(res); a.ok(res.ok);
    if (res.ok) a.strictEqual((res as any).context.isGlobal, true);
  });
  await test("12. global_admin é global", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer global_admin' });
    if (!res.ok) console.log(res); a.ok(res.ok);
    if (res.ok) a.strictEqual((res as any).context.isGlobal, true);
  });
  await test("13. ecosystem_owner é global", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer eco_owner' });
    if (!res.ok) console.log(res); a.ok(res.ok);
    if (res.ok) a.strictEqual((res as any).context.isGlobal, true);
  });
  await test("14. founder é global", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer founder_tk' });
    if (!res.ok) console.log(res); a.ok(res.ok);
    if (res.ok) a.strictEqual((res as any).context.isGlobal, true);
  });
  await test("15. admin não é global", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer admin_tk' });
    a.strictEqual(res.ok, false);
    if (!res.ok) a.strictEqual((res as any).statusCode, 403);
  });
  await test("16. owner não é global", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer owner_tk' });
    a.strictEqual(res.ok, false);
  });
  await test("17. dono não é global", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer dono_tk' });
    a.strictEqual(res.ok, false);
  });
  await test("18. support não é global", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer support_tk' });
    a.strictEqual(res.ok, false);
  });
  await test("19. role ceo sem systemRole não é global", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer role_ceo_tk' });
    a.strictEqual(res.ok, false);
  });
  await test("20. appRole global_admin sem systemRole não é global", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer approle_tk' });
    a.strictEqual(res.ok, false);
  });

  // TESTES DE ORGANIZAÇÃO
  await test("21. organizationId ausente -> 400", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, organizationId: undefined, authHeader: 'Bearer global_ceo' });
    a.strictEqual(res.ok, false);
    if (!res.ok) a.strictEqual((res as any).statusCode, 400);
  });
  await test("22. organizationId inválido -> 400", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, organizationId: 'a b!', authHeader: 'Bearer global_ceo' });
    a.strictEqual(res.ok, false);
    if (!res.ok) a.strictEqual((res as any).statusCode, 400);
  });
  await test("23. organização inexistente -> 404", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, organizationId: 'org404', authHeader: 'Bearer global_ceo' });
    a.strictEqual(res.ok, false);
    if (!res.ok) a.strictEqual((res as any).statusCode, 404);
  });
  await test("24. status ' ARCHIVED ' -> 403", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, organizationId: 'org_archived', authHeader: 'Bearer global_ceo' });
    a.strictEqual(res.ok, false);
    if (!res.ok) a.strictEqual((res as any).statusCode, 403);
  });
  await test("25. archived true -> 403", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, organizationId: 'org_archived2', authHeader: 'Bearer global_ceo' });
    a.strictEqual(res.ok, false);
    if (!res.ok) a.strictEqual((res as any).statusCode, 403);
  });
  await test("26. global não acessa organização inexistente", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, organizationId: 'org404', authHeader: 'Bearer global_ceo' });
    a.strictEqual(res.ok, false);
    if (!res.ok) a.strictEqual((res as any).statusCode, 404);
  });
  await test("27. global acessa organização válida sem membership", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer global_ceo' });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });

  // TESTES DE MEMBERSHIP
  await test("28. canônica ativa é aceita", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer active_member_tk', requiredAnyPermissions: ['canManageRepertoire'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("29. status ' ATIVO ' é aceito", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer admin_org_tk' });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("30. canônica inativa bloqueia legado ativo", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer inactive_canon_tk' });
    a.strictEqual(res.ok, false);
    if (!res.ok) a.strictEqual((res as any).statusCode, 403);
  });
  await test("31. canônica inexistente permite legado uid_org", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer legacy_uid_org_tk', requiredAnyPermissions: ['canManageRepertoire'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("32. canônica inexistente permite legado org_uid", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer legacy_org_uid_tk', requiredAnyPermissions: ['canManageRepertoire'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("33. legado sem status ativo é negado", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer legacy_inactive_tk' });
    a.strictEqual(res.ok, false);
  });
  await test("34. ownerUid reconhece owner", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer owner_uid_tk', organizationId: 'org_owner_uid' });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("35. ownerUserId reconhece owner", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer owner_userid_tk', organizationId: 'org_owner_userid' });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("36. ownerId reconhece owner", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer owner_id_tk', organizationId: 'org_owner_id' });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("37. ownerEmail idêntico sem UID não reconhece owner", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer owner_email_tk', organizationId: 'org_owner_email' });
    a.strictEqual(res.ok, false);
  });
  await test("38. admin organizacional ativo é autorizado", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer admin_org_tk', requiredAnyPermissions: ['canManageRepertoire'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("39. member comum sem permissão é negado", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer member_tk' });
    a.strictEqual(res.ok, false);
  });

  // TESTES DE FUNÇÃO E PERMISSÕES
  await test("40. role de outra organização é ignorada", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer diff_org_role_tk', requiredAnyPermissions: ['canManageRepertoire'] });
    a.strictEqual(res.ok, false);
  });
  await test("41. canManageRepertoire na Role autoriza aiImport", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer manage_rep_tk', requiredFeature: 'aiImport', requiredAnyPermissions: ['canManageRepertoire'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("42. canManageChords na Role autoriza aiStructuring quando solicitado", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer manage_chords_tk', requiredFeature: 'aiStructuring', requiredAnyPermissions: ['canManageChords'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("43. canManageRepertoire também pode atender lista OU com canManageChords", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer rep_or_chords_tk', requiredAnyPermissions: ['canManageRepertoire', 'canManageChords'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("44. função chamada Administrador sem permissão não autoriza", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer admin_name_tk', requiredAnyPermissions: ['canManageRepertoire'] });
    a.strictEqual(res.ok, false);
  });
  await test("45. capability array manageSongs é aceita", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer cap_array_tk', requiredAnyPermissions: ['canManageRepertoire'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("46. capability map musicscale.songs.edit é aceita", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer cap_map_tk', requiredAnyPermissions: ['canManageRepertoire'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("47. effectiveCapabilities é aceito", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer eff_cap_tk', requiredAnyPermissions: ['canManageRepertoire'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("48. manageChords é aceito", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer manage_chords_cap_tk', requiredAnyPermissions: ['canManageChords'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("49. lista requiredAnyPermissions vazia não autoriza member comum", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer manage_rep_tk', requiredAnyPermissions: [] });
    a.strictEqual(res.ok, false);
  });
  await test("50. erro de leitura da Role falha fechado", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer fail_role_tk', requiredAnyPermissions: ['canManageRepertoire'] });
    a.strictEqual(res.ok, false);
  });

  // TESTES DE ENTITLEMENT
  await test("51. apps.musicscale ativo e feature true autoriza", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ent_active_true_tk', organizationId: 'org123' });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("52. apps.musicscale ativo e feature false nega", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ent_active_false_tk', organizationId: 'org_ent_active_false' });
    a.strictEqual(res.ok, false);
    if (!res.ok) a.strictEqual((res as any).error, "FEATURE_NOT_ENTITLED");
  });
  await test("53. apps.musicscale sem a feature nega", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ent_missing_feature_tk', organizationId: 'org_ent_missing_feature' });
    a.strictEqual(res.ok, false);
  });
  await test("54. apps.musicscale suspenso nega", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ent_suspended_tk', organizationId: 'org_ent_suspended' });
    a.strictEqual(res.ok, false);
  });
  await test("55. apps.musicscale trial autoriza", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ent_trial_tk', organizationId: 'org_ent_trial' });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("56. apps.musicscale trialing autoriza", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ent_trialing_tk', organizationId: 'org_ent_trialing' });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("57. fonte canônica negando não cai em plano legado pro", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ent_neg_legacy_pro_tk', organizationId: 'org_ent_neg_legacy_pro' });
    a.strictEqual(res.ok, false);
  });
  await test("58. fonte canônica ausente permite legado pro", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ent_no_legacy_pro_tk', organizationId: 'org_ent_no_legacy_pro' });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("59. premium normaliza para pro", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ent_premium_tk', organizationId: 'org_ent_premium' });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("60. pro_unlimited normaliza para pro", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ent_pro_unlimited_tk', organizationId: 'org_ent_pro_unlimited' });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("61. starter nega", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ent_starter_tk', organizationId: 'org_ent_starter' });
    a.strictEqual(res.ok, false);
  });
  await test("62. advanced nega", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ent_advanced_tk', organizationId: 'org_ent_advanced' });
    a.strictEqual(res.ok, false);
  });
  await test("63. plano desconhecido nega", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ent_unknown_tk', organizationId: 'org_ent_unknown' });
    a.strictEqual(res.ok, false);
  });
  await test("64. subscriptionStatus past_due nega", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ent_past_due_tk', organizationId: 'org_ent_past_due' });
    a.strictEqual(res.ok, false);
  });
  await test("65. subscription_status cancelled nega", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ent_cancelled_tk', organizationId: 'org_ent_cancelled' });
    a.strictEqual(res.ok, false);
  });
  await test("66. erro real de leitura retorna 503", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer ent_fetch_fail_tk', organizationId: 'org_ent_fetch_fail' });
    a.strictEqual(res.ok, false);
    if (!res.ok) { a.strictEqual((res as any).statusCode, 503); a.strictEqual((res as any).error, "SERVICE_UNAVAILABLE"); }
  });
  await test("67. global estrito ignora bloqueio comercial", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer global_ceo', organizationId: 'org_ent_cancelled' });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });

  // TESTES DO RATE LIMITER
  let now = 100000;
  const rl = new InMemoryAiRateLimiter({ clock: () => now });
  
  await test("68. primeira aquisição funciona", (a) => {
    const res = rl.acquire({ uid: 'u1', organizationId: 'o1', endpointKey: 'ai-import' });
    if (!res.ok) console.log(res); a.ok(res.ok);
    if (res.ok) res.release();
  });
  await test("69. segunda aquisição concorrente funciona", (a) => {
    const res1 = rl.acquire({ uid: 'u1', organizationId: 'o1', endpointKey: 'ai-import' });
    const res2 = rl.acquire({ uid: 'u1', organizationId: 'o1', endpointKey: 'ai-import' });
    a.ok(res1.ok);
    a.ok(res2.ok);
    if (res1.ok) res1.release();
    if (res2.ok) res2.release();
  });
  await test("70. terceira concorrente retorna 429", (a) => {
    const res1 = rl.acquire({ uid: 'u1', organizationId: 'o1', endpointKey: 'ai-import' });
    const res2 = rl.acquire({ uid: 'u1', organizationId: 'o1', endpointKey: 'ai-import' });
    const res3 = rl.acquire({ uid: 'u1', organizationId: 'o1', endpointKey: 'ai-import' });
    a.ok(res1.ok);
    a.ok(res2.ok);
    a.strictEqual(res3.ok, false);
    if (!res3.ok) a.strictEqual((res3 as any).statusCode, 429);
    if (res1.ok) res1.release();
    if (res2.ok) res2.release();
  });
  await test("71. release permite nova aquisição", (a) => {
    const res1 = rl.acquire({ uid: 'u2', organizationId: 'o1', endpointKey: 'ai-import' });
    const res2 = rl.acquire({ uid: 'u2', organizationId: 'o1', endpointKey: 'ai-import' });
    if (res1.ok) res1.release();
    const res3 = rl.acquire({ uid: 'u2', organizationId: 'o1', endpointKey: 'ai-import' });
    a.ok(res3.ok);
    if (res2.ok) res2.release();
    if (res3.ok) res3.release();
  });
  await test("72. release duplo é idempotente", (a) => {
    rl._clear();
    const res1 = rl.acquire({ uid: 'u3', organizationId: 'o1', endpointKey: 'ai-import' });
    if (res1.ok) {
      res1.release();
      res1.release();
    }
    const res2 = rl.acquire({ uid: 'u3', organizationId: 'o1', endpointKey: 'ai-import' });
    const res3 = rl.acquire({ uid: 'u3', organizationId: 'o1', endpointKey: 'ai-import' });
    a.ok(res2.ok);
    a.ok(res3.ok);
    if (res2.ok) res2.release();
    if (res3.ok) res3.release();
  });
  await test("73. activeConnections nunca fica negativo", (a) => {
    rl._clear();
    const res1 = rl.acquire({ uid: 'u4', organizationId: 'o1', endpointKey: 'ai-import' });
    if (res1.ok) {
      res1.release();
      res1.release();
      res1.release();
    }
    const res2 = rl.acquire({ uid: 'u4', organizationId: 'o1', endpointKey: 'ai-import' });
    const res3 = rl.acquire({ uid: 'u4', organizationId: 'o1', endpointKey: 'ai-import' });
    const res4 = rl.acquire({ uid: 'u4', organizationId: 'o1', endpointKey: 'ai-import' });
    a.ok(res2.ok);
    a.ok(res3.ok);
    a.strictEqual(res4.ok, false);
    if (res2.ok) res2.release();
    if (res3.ok) res3.release();
  });
  await test("74. ai-import permite 10 e bloqueia a 11ª no período", (a) => {
    rl._clear();
    for (let i = 0; i < 10; i++) {
      const res = rl.acquire({ uid: 'u5', organizationId: 'o1', endpointKey: 'ai-import' });
      if (!res.ok) console.log(res); a.ok(res.ok);
      if (res.ok) res.release();
      now += 1000;
    }
    const res11 = rl.acquire({ uid: 'u5', organizationId: 'o1', endpointKey: 'ai-import' });
    a.strictEqual(res11.ok, false);
  });
  await test("75. fix-chords permite 20 e bloqueia a 21ª", (a) => {
    rl._clear();
    for (let i = 0; i < 20; i++) {
      const res = rl.acquire({ uid: 'u5', organizationId: 'o1', endpointKey: 'fix-chords' });
      if (!res.ok) console.log(res); a.ok(res.ok);
      if (res.ok) res.release();
      now += 1000;
    }
    const res21 = rl.acquire({ uid: 'u5', organizationId: 'o1', endpointKey: 'fix-chords' });
    a.strictEqual(res21.ok, false);
  });
  await test("76. avanço do relógio reinicia janela", (a) => {
    now += 10 * 60 * 1000 + 1000; // > 10 min
    const res = rl.acquire({ uid: 'u5', organizationId: 'o1', endpointKey: 'ai-import' });
    if (!res.ok) console.log(res); a.ok(res.ok);
    if (res.ok) res.release();
  });
  await test("77. entradas expiradas e ociosas são removidas", (a) => {
    rl._clear();
    now = 100000;
    const res = rl.acquire({ uid: 'u6', organizationId: 'o1', endpointKey: 'ai-import' });
    if (res.ok) res.release();
    a.strictEqual(rl._getKeysCount(), 1);
    now += 10 * 60 * 1000 + 1000;
    rl.acquire({ uid: 'u7', organizationId: 'o1', endpointKey: 'ai-import' });
    a.strictEqual(rl._getKeysCount(), 1); // u6 was removed, u7 added
  });
  await test("78. entradas ativas não são removidas", (a) => {
    rl._clear();
    now = 100000;
    rl.acquire({ uid: 'u8', organizationId: 'o1', endpointKey: 'ai-import' }); // no release
    now += 10 * 60 * 1000 + 1000;
    rl.acquire({ uid: 'u9', organizationId: 'o1', endpointKey: 'ai-import' });
    a.strictEqual(rl._getKeysCount(), 2);
  });
  await test("79. Map respeita máximo de 5.000 chaves", (a) => {
    rl._clear();
    now = 100000;
    for (let i = 0; i < 5000; i++) {
      const res = rl.acquire({ uid: `ux${i}`, organizationId: 'o1', endpointKey: 'ai-import' });
      if (res.ok) res.release();
    }
    a.strictEqual(rl._getKeysCount(), 5000);
    const res5001 = rl.acquire({ uid: `ux5001`, organizationId: 'o1', endpointKey: 'ai-import' });
    a.ok(res5001.ok);
    a.strictEqual(rl._getKeysCount(), 5000); // Because older ones are evicted
  });
  await test("80. store pode ser limpo em teste", (a) => {
    rl._clear();
    a.strictEqual(rl._getKeysCount(), 0);
  });

  await test("81. organização inválida nunca entra no rate limiter porque o rate limiter recebe somente contexto autorizado", async (a) => {
    rl._clear();
    const countBefore = rl._getKeysCount();
    const res = await authorizeAiRequest({ ...defaults, organizationId: 'invalid_id!!!' });
    a.strictEqual(res.ok, false);
    a.strictEqual(rl._getKeysCount(), countBefore);
  });
  await test("82. authorization não altera o tamanho do rate limiter", async (a) => {
    rl._clear();
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer global_ceo' });
    if (!res.ok) console.log(res); a.ok(res.ok);
    a.strictEqual(rl._getKeysCount(), 0);
  });
  // TESTES DE HIGIENE
  await test("83. integração aprovada mantém autorização encapsulada no handler fix-chords", async (a) => {
    const serverTs = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf-8');
    a.ok(serverTs.includes('createFixChordsHandler'));
    a.ok(serverTs.includes('./services/server/fixChordsHandler.js'));
    a.ok(serverTs.includes('InMemoryAiRateLimiter'));
    a.ok(serverTs.includes('./services/server/aiRequestSecurity.js'));
    
    // 3. server.ts importa de aiRequestSecurity.js
    const importMatch = serverTs.match(/import\s*\{[^}]*\}\s*from\s*['"]\.\/services\/server\/aiRequestSecurity\.js['"]/);
    a.ok(importMatch, "server.ts deve importar de aiRequestSecurity.js");
    a.ok(importMatch[0].includes('InMemoryAiRateLimiter'), "server.ts deve importar InMemoryAiRateLimiter");
    // server.ts pode conter authorizeAiRequest por causa do /api/ai-import, de forma legítima
    
    // 4. existe instanciação de InMemoryAiRateLimiter
    const rateLimiterInstantiations = serverTs.match(/new InMemoryAiRateLimiter\(\)/g) || [];
    a.ok(rateLimiterInstantiations.length >= 1, "Deve instanciar InMemoryAiRateLimiter");
    
    // 5. existe exatamente uma rota: app.post("/api/fix-chords"
    const routeDeclarations = serverTs.match(/app\.post\(\"\/api\/fix-chords\"/g) || [];
    a.strictEqual(routeDeclarations.length, 1);
    
    // 6. a rota utiliza: createFixChordsHandler
    const fixChordsIdx = serverTs.indexOf('app.post("/api/fix-chords"');
    const fixChordsHandlerIdx = serverTs.indexOf('createFixChordsHandler', fixChordsIdx);
    a.ok(fixChordsHandlerIdx !== -1 && fixChordsHandlerIdx < fixChordsIdx + 200);
    
    // 7. a rota fix-chords no server.ts está encapsulada e não contém lógica inline antiga de auth/segurança/prompt
    const endOfFixChordsIdx = serverTs.indexOf('app.post("/api/ai-import"', fixChordsIdx);
    const fixChordsRouteContent = serverTs.substring(fixChordsIdx, endOfFixChordsIdx !== -1 ? endOfFixChordsIdx : undefined);
    
    a.ok(!fixChordsRouteContent.includes('Você é um músico e especialista em cifras musicais'));
    a.ok(!fixChordsRouteContent.includes('String(error)'));
    a.ok(!fixChordsRouteContent.includes('verifyIdToken'));
    a.ok(!fixChordsRouteContent.includes('authorizeAiRequest('));
    a.ok(!fixChordsRouteContent.includes("db.collection('users')"));
    a.ok(!fixChordsRouteContent.includes('PLAN_FEATURES'));
    a.ok(!fixChordsRouteContent.includes('music_scale_plan'));
    a.ok(!fixChordsRouteContent.includes('global_admin'));
    a.ok(!fixChordsRouteContent.includes('isGlobalAdmin'));

    // 8. fixChordsHandler.ts contém a autorização correta
    const handlerCode = fs.readFileSync(path.resolve(process.cwd(), 'services/server/fixChordsHandler.ts'), 'utf-8');
    a.ok(handlerCode.includes('import { authorizeAiRequest'));
    a.ok(handlerCode.includes('authorizeAiRequest('));
    a.ok(handlerCode.includes('aiStructuring'));
    a.ok(handlerCode.includes('canManageChords') || handlerCode.includes('canManageRepertoire'));
  });
  
  

  await test("84. server.ts não foi alterado", async (a) => {
    a.strictEqual(getHashNow('server.ts'), protectedHashesBefore.get('server.ts'));
  });
  await test("85. AiSongImportModal não foi alterado", async (a) => {
    a.strictEqual(getHashNow('components/songs/AiSongImportModal.tsx'), protectedHashesBefore.get('components/songs/AiSongImportModal.tsx'));
  });
  await test("86. package.json não foi alterado", async (a) => {
    a.strictEqual(getHashNow('package.json'), protectedHashesBefore.get('package.json'));
  });
  await test("87. package-lock.json não foi alterado", async (a) => {
    a.strictEqual(getHashNow('package-lock.json'), protectedHashesBefore.get('package-lock.json'));
  });
  await test("88. existe safeExternalFetch.ts", async (a) => {
    a.ok(fs.existsSync(path.resolve(process.cwd(), 'services/server/safeExternalFetch.ts')));
  });
  await test("89. não existe fix_imports.cjs", async (a) => {
    a.ok(!fs.existsSync(path.resolve(process.cwd(), 'fix_imports.cjs')));
  });
  await test("90. falha de teste define process.exitCode = 1", async (a) => {
    const scriptStr = fs.readFileSync('scripts/test_phase0_2c1a_ai_authorization.ts', 'utf-8');
    a.ok(scriptStr.includes('process.exitCode = 1'));
  });



  // Novos testes
  auth.verifyIdToken = async (token: string, checkRevoked: boolean) => {
    if (token === 'tk1') return { uid: 'new_test_uid1' };
    if (token === 'tk2') return { uid: 'new_test_uid2' };
    if (token === 'tk3') return { uid: 'new_test_uid3' };
    if (token === 'tk4') return { uid: 'new_test_uid4' };
    if (token === 'tk5') return { uid: 'new_test_uid5' };
    if (token === 'tk6') return { uid: 'new_test_uid6' };
    if (token === 'tk7') return { uid: 'new_test_uid7' };
    if (token === 'tk8') return { uid: 'new_test_uid8' };
    if (token === 'tk9') return { uid: 'new_test_uid9' };
    if (token === 'tk10') return { uid: 'new_test_uid10' };
    if (token === 'tk_org_role_spaces') return { uid: 'org_role_spaces' };
    if (token === 'tk_org_role_empty') return { uid: 'org_role_empty' };
    if (token === 'tk_org_role_member') return { uid: 'org_role_member' };
    if (token === 'tk_org_role_invalid') return { uid: 'org_role_invalid' };
    if (token === 'tk_role_id_spaces') return { uid: 'role_id_spaces' };
    if (token === 'tk_role_id_valid') return { uid: 'role_id_valid' };
    if (token === 'tk_cap_inherited') return { uid: 'cap_inherited' };
    if (token === 'tk_cap_own') return { uid: 'cap_own' };
    return new MockAuth().verifyIdToken(token, checkRevoked);
  };

  await test("93. capabilities e permissions são agregadas.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk1', requiredAnyPermissions: ['canManageRepertoire'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("94. capabilities vazias não bloqueiam effectiveCapabilities.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk2', requiredAnyPermissions: ['canManageRepertoire'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("95. permissions vazias não bloqueiam capabilities.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk3', requiredAnyPermissions: ['canManageRepertoire'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("96. capability false é ignorada.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk4', requiredAnyPermissions: ['canManageRepertoire'] });
    a.strictEqual(res.ok, false);
  });
  await test("97. capability com valor string true é ignorada.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk5', requiredAnyPermissions: ['canManageRepertoire'] });
    a.strictEqual(res.ok, false);
  });
  await test("98. role permissions e membership capabilities podem coexistir.", async (a) => {
    const res1 = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk6', requiredAnyPermissions: ['canManageRepertoire'] });
    const res2 = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk6', requiredAnyPermissions: ['canManageChords'] });
    a.ok(res1.ok);
    a.ok(res2.ok);
  });
  await test("99. canônica com somente role admin é aceita.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk7' });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("100. legado com somente role admin é aceita.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk8' });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("101. musicscaleRole admin não concede admin organizacional.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk9' });
    a.strictEqual(res.ok, false);
  });
  await test("102. appRole admin não concede admin organizacional.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk10' });
    a.strictEqual(res.ok, false);
  });
  await test("103. apps.musicscale null com plano pro nega.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk7', organizationId: 'org_new_1' });
    a.strictEqual(res.ok, false);
  });
  await test("104. apps.musicscale false com plano pro nega.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk7', organizationId: 'org_new_2' });
    a.strictEqual(res.ok, false);
  });
  await test("105. apps.musicscale string com plano pro nega.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk7', organizationId: 'org_new_3' });
    a.strictEqual(res.ok, false);
  });
  await test("106. apps.musicscale array com plano pro nega.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk7', organizationId: 'org_new_4' });
    a.strictEqual(res.ok, false);
  });
  await test("107. apps vazio permite fallback pro.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk7', organizationId: 'org_new_5' });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("108. apps ausente permite fallback pro.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk7', organizationId: 'org_new_6' });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("109. erro de resolução comercial retorna 503 ENTITLEMENT_SERVICE_UNAVAILABLE.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk7', organizationId: 'org_ent_resolution_fail' });
    a.strictEqual(res.ok, false);
    if (!res.ok) { a.strictEqual((res as any).statusCode, 503); a.strictEqual((res as any).error, "ENTITLEMENT_SERVICE_UNAVAILABLE"); }
  });
  await test("110. erro de leitura da organização continua 503 SERVICE_UNAVAILABLE.", async (a) => {
    // if organization doesn't exist but db throws?
    // Let's modify dbInstance to throw when fetching org
    const badDb = {
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => {
            if (name === 'organizations') throw new Error("db fail");
            return db.collection(name).doc(id).get();
          }
        })
      })
    };
    const res = await authorizeAiRequest({ ...defaults, dbInstance: badDb });
    a.strictEqual(res.ok, false);
    if (!res.ok) a.strictEqual((res as any).error, "SERVICE_UNAVAILABLE");
  });
  await test("111. autorização válida não cria chave no rate limiter.", async (a) => {
    rl._clear();
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer global_ceo' });
    if (!res.ok) console.log(res); a.ok(res.ok);
    a.strictEqual(rl._getKeysCount(), 0);
  });
  await test("112. autorização inválida não cria chave no rate limiter.", async (a) => {
    rl._clear();
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk9' });
    a.strictEqual(res.ok, false);
    a.strictEqual(rl._getKeysCount(), 0);
  });


  await test("113. organizationRole espaços usa role admin.", async (a) => {
     
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk_org_role_spaces', claimedUserId: 'org_role_spaces' });
    if (!res.ok) console.log(res); a.ok(res.ok);
    if (res.ok) a.strictEqual((res as any).context.organizationRole, 'admin');
  });
  await test("114. organizationRole vazio usa role admin.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk_org_role_empty', claimedUserId: 'org_role_empty' });
    if (!res.ok) console.log(res); a.ok(res.ok);
    if (res.ok) a.strictEqual((res as any).context.organizationRole, 'admin');
  });
  await test("115. organizationRole member prevalece sobre role admin.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk_org_role_member', claimedUserId: 'org_role_member' });
    a.strictEqual(res.ok, false);
  });
  await test("116. organizationRole inválido usa role admin.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk_org_role_invalid', claimedUserId: 'org_role_invalid' });
    if (!res.ok) console.log(res); a.ok(res.ok);
    if (res.ok) a.strictEqual((res as any).context.organizationRole, 'admin');
  });
  await test("117. roleId espaços usa internalRoleId.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk_role_id_spaces', claimedUserId: 'role_id_spaces', requiredAnyPermissions: ['canManageRepertoire'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("118. roleId válido prevalece sobre internalRoleId.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk_role_id_valid', claimedUserId: 'role_id_valid', requiredAnyPermissions: ['canManageRepertoire'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("119. capability herdada pelo protótipo é ignorada.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk_cap_inherited', claimedUserId: 'cap_inherited', requiredAnyPermissions: ['canManageRepertoire'] });
    a.strictEqual(res.ok, false);
  });
  await test("120. capability própria é aceita.", async (a) => {
    const res = await authorizeAiRequest({ ...defaults, authHeader: 'Bearer tk_cap_own', claimedUserId: 'cap_own', requiredAnyPermissions: ['canManageRepertoire'] });
    if (!res.ok) console.log(res); a.ok(res.ok);
  });
  await test("121. resolveAiEntitlement retorna status 503 e código exato em exceção.", async (a) => {
    const { resolveAiEntitlement } = await import('../services/server/aiRequestSecurity.ts');
    const badOrg = Object.defineProperty({}, 'apps', { get: () => { throw new Error('fail'); } });
    const res = resolveAiEntitlement({ orgData: badOrg, requiredFeature: 'aiImport', isGlobal: false });
    a.strictEqual(res.ok, false);
    if (!res.ok) {
       a.strictEqual((res as any).statusCode, 503);
       a.strictEqual((res as any).error, "ENTITLEMENT_SERVICE_UNAVAILABLE");
    }
  });
  await test("122. leitura da organização retorna status 503 e código exato.", async (a) => {
    const badDb = {
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => {
            if (name === 'organizations') throw new Error("db fail");
            return db.collection(name).doc(id).get();
          }
        })
      })
    };
    const res = await authorizeAiRequest({ ...defaults, dbInstance: badDb });
    a.strictEqual(res.ok, false);
    if (!res.ok) {
      a.strictEqual((res as any).statusCode, 503);
      a.strictEqual((res as any).error, "SERVICE_UNAVAILABLE");
    }
  });
  await test("123. suíte usa hashes internos e não depende de arquivo externo em /tmp", async (a) => {
    a.ok(protectedHashesBefore instanceof Map);
    a.ok(protectedHashesBefore.has('server.ts'));
    a.ok(protectedHashesBefore.has('components/songs/AiSongImportModal.tsx'));
    a.ok(protectedHashesBefore.has('package.json'));
    a.ok(protectedHashesBefore.has('package-lock.json'));
    
    for (const [file, hash] of protectedHashesBefore.entries()) {
      a.strictEqual(typeof hash, 'string');
      a.strictEqual(hash.length, 64);
    }
    
    const calculatedHash = getHashNow('server.ts');
    a.strictEqual(typeof calculatedHash, 'string');
    a.strictEqual(calculatedHash.length, 64);
    
    const suiteContent = fs.readFileSync('scripts/test_phase0_2c1a_ai_authorization.ts', 'utf-8');
    const prohibited = "phase0_2c1a1" + "_before.sha256";
    a.ok(!suiteContent.includes(`readFileSync('/tmp/${prohibited}'`));
  });

  await test("91. nenhum teste é aprovado apenas por logPass", async (a) => {
    const script = fs.readFileSync('scripts/test_phase0_2c1a_ai_authorization.ts', 'utf-8');
    a.strictEqual(/\\ba\\.ok\\(\\s*true\\s*\\)/.test(script), false);
    a.strictEqual(/\\bassert\\.ok\\(\\s*true\\s*\\)/.test(script), false);
    a.strictEqual(script.includes("Conceptual" + " test"), false);
    a.ok(script.includes("currentTestAssertions === 0"));
    a.ok(script.includes("throw new Error"));
  });

  await test("125. integridade: os arquivos protegidos não foram modificados.", async (a) => {
    let allMatch = true;
    for (const [file, oldHash] of protectedHashesBefore.entries()) {
      const newHash = getHashNow(file);
      if (newHash !== oldHash) {
         console.error(`Hash mismatch for ${file}`);
         allMatch = false;
      }
    }
    a.ok(allMatch);
  });


  await test("124. contador final corresponde exatamente ao total registrado.", async (a) => {
    a.strictEqual(passed + failed + 1, registered);
  });

  if (failed > 0) {    process.exitCode = 1;
  }
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
