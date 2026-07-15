import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildEffectiveAccessContext, hasMusicScaleCapability } from './utils/rbac.js';
import {
  generateDeterministicStarterSongId,
  normalizeStarterSong,
  buildUpdatedOnboardingState,
  computeStarterImportPlan,
  resolveStarterEntitlementState
} from './services/server/onboarding/firstScaleOnboardingService.js';

describe('First Scale Onboarding Experience Tests', () => {

  describe('Security and RBAC Capability Checks', () => {
    it('Global Admin has all read and write capability for songs and taxonomy', () => {
      const ctx = buildEffectiveAccessContext('u1', 'org_test_1', 'global_admin', null, 'active');
      assert.strictEqual(hasMusicScaleCapability(ctx, 'songs.read'), true);
      assert.strictEqual(hasMusicScaleCapability(ctx, 'songs.create'), true);
      assert.strictEqual(hasMusicScaleCapability(ctx, 'taxonomy.eventTypes.manage'), true);
      assert.strictEqual(hasMusicScaleCapability(ctx, 'taxonomy.locations.manage'), true);
    });

    it('Organization Owner has read/create songs and manage taxonomy capabilities', () => {
      const ctx = buildEffectiveAccessContext('u2', 'org_test_1', null, 'owner', 'active');
      assert.strictEqual(hasMusicScaleCapability(ctx, 'songs.read'), true);
      assert.strictEqual(hasMusicScaleCapability(ctx, 'songs.create'), true);
      assert.strictEqual(hasMusicScaleCapability(ctx, 'taxonomy.eventTypes.manage'), true);
      assert.strictEqual(hasMusicScaleCapability(ctx, 'taxonomy.locations.manage'), true);
    });

    it('Organization Member (Active) has songs.read but NOT songs.create or taxonomy.manage capabilities', () => {
      const ctx = buildEffectiveAccessContext('u3', 'org_test_1', null, 'member', 'active');
      assert.strictEqual(hasMusicScaleCapability(ctx, 'songs.read'), true);
      assert.strictEqual(hasMusicScaleCapability(ctx, 'songs.create'), false);
      assert.strictEqual(hasMusicScaleCapability(ctx, 'taxonomy.eventTypes.manage'), false);
      assert.strictEqual(hasMusicScaleCapability(ctx, 'taxonomy.locations.manage'), false);
    });
  });

  describe('Deterministic ID Generation Logic (Service Layer)', () => {
    it('Generates exact same IDs for identical inputs (Idempotency)', () => {
      const orgId = "org_123";
      const globalSongId = "song_abc";
      const version = "1.0";

      const id1 = generateDeterministicStarterSongId(orgId, globalSongId, version);
      const id2 = generateDeterministicStarterSongId(orgId, globalSongId, version);

      assert.strictEqual(id1, id2);
      assert.match(id1, /^starter_[a-f0-9]{20}$/);
    });

    it('Generates different IDs for different organizations', () => {
      const globalSongId = "song_abc";
      const version = "1.0";

      const idOrg1 = generateDeterministicStarterSongId("org_1", globalSongId, version);
      const idOrg2 = generateDeterministicStarterSongId("org_2", globalSongId, version);

      assert.notStrictEqual(idOrg1, idOrg2);
    });

    it('Generates different IDs for different starter pack versions', () => {
      const orgId = "org_123";
      const globalSongId = "song_abc";

      const idV1 = generateDeterministicStarterSongId(orgId, globalSongId, "1.0");
      const idV2 = generateDeterministicStarterSongId(orgId, globalSongId, "2.0");

      assert.notStrictEqual(idV1, idV2);
    });
  });

  describe('Onboarding State & Limit Checks (Service Layer)', () => {
    it('Enforces 10-song limit strictly via buildUpdatedOnboardingState', () => {
      const existingState = {
        starterPackImportedGlobalIds: ["s1", "s2", "s3", "s4", "s5"]
      };
      const newGlobalIds = ["s6", "s7", "s8", "s9", "s10", "s11"]; // total 11

      assert.throws(() => {
        buildUpdatedOnboardingState(existingState, newGlobalIds, "u123");
      }, /starter_pack_limit_exceeded/);
    });

    it('Successfully updates onboarding state within 10-song limit', () => {
      const existingState = {
        starterPackImportedGlobalIds: ["s1", "s2", "s3"]
      };
      const newGlobalIds = ["s4", "s5"]; // total 5

      const result = buildUpdatedOnboardingState(existingState, newGlobalIds, "u123", "1.0");
      assert.strictEqual(result.starterPackImportedCount, 5);
      assert.deepStrictEqual(result.starterPackImportedGlobalIds, ["s1", "s2", "s3", "s4", "s5"]);
    });

    it('Computes correct starter pack import plan via computeStarterImportPlan', () => {
      const starterSongs = [
        { id: "song_1", title: "Song 1" },
        { id: "song_2", title: "Song 2" },
        { id: "song_3", title: "Song 3" }
      ];
      const selectedSongIds = ["song_1", "song_2", "song_3"];

      // Case A: pre-existing organization song that is NOT from the starter pack
      const planA = computeStarterImportPlan({
        selectedSongIds,
        starterSongs,
        existingOrganizationGlobalIds: ["song_1"],
        starterPackImportedGlobalIds: [],
        orgId: "org123"
      });

      assert.strictEqual(planA.limitExceeded, false);
      assert.strictEqual(planA.projectedTotalCount, 2); // only song_2 and song_3 are starter pack songs
      assert.deepStrictEqual(planA.skippedIds, ["song_1"]);
      assert.strictEqual(planA.songsToImport.length, 2);
      assert.strictEqual(planA.songsToImport[0].id, "song_2");

      // Case B: already-imported starter pack song
      const planB = computeStarterImportPlan({
        selectedSongIds,
        starterSongs,
        existingOrganizationGlobalIds: ["song_1"],
        starterPackImportedGlobalIds: ["song_1"],
        orgId: "org123"
      });

      assert.strictEqual(planB.limitExceeded, false);
      assert.strictEqual(planB.projectedTotalCount, 3); // song_1 is kept as a starter pack song
      assert.deepStrictEqual(planB.skippedIds, ["song_1"]);
      assert.strictEqual(planB.songsToImport.length, 2);
    });
  });

  describe('Standard Song Structure Normalization (Service Layer)', () => {
    it('Includes all required properties with correct default fallback values', () => {
      const rawSong = {
        id: "global_123",
        title: "Quem é Esse?",
        artist: "Julliany Souza",
        key: "F#",
        bpm: 72,
        sections: [],
        tagIds: []
      };
      const createdBy = { uid: "user_test_1", displayName: "Test User", photoURL: null };
      const normalized = normalizeStarterSong(rawSong, "org_123", createdBy, "user_test_1", "1.0");

      assert.strictEqual(normalized.id, generateDeterministicStarterSongId("org_123", "global_123", "1.0"));
      assert.strictEqual(normalized.organizationId, "org_123");
      assert.strictEqual(normalized.title, "Quem é Esse?");
      assert.strictEqual(normalized.artist, "Julliany Souza");
      assert.strictEqual(normalized.originalKey, "F#");
      assert.strictEqual(normalized.selectedKey, "F#");
      assert.strictEqual(normalized.bpm, 72);
      assert.deepStrictEqual(normalized.tagIds, []);
      assert.strictEqual(normalized.lastPlayed, null);
      assert.strictEqual(normalized.status, 'active');
      assert.strictEqual(normalized.bpmConfidence, 'high');
      assert.strictEqual(normalized.freshness.status, 'new');
      assert.deepStrictEqual(normalized.createdBy, createdBy);
    });
  });

  describe('Onboarding Detailed and Boundary Cases', () => {
    it('músicas normais da Biblioteca não consomem o limite starter', () => {
      const starterSongs = [
        { id: "song_1", title: "Song 1" }
      ];
      const selectedSongIds = ["song_1", "song_2"];
      const plan = computeStarterImportPlan({
        selectedSongIds,
        starterSongs,
        existingOrganizationGlobalIds: [],
        starterPackImportedGlobalIds: [],
        orgId: "org123"
      });
      assert.strictEqual(plan.projectedTotalCount, 1);
      assert.strictEqual(plan.songsToImport.length, 1);
      assert.strictEqual(plan.songsToImport[0].id, "song_1");
    });

    it('IDs duplicados são tratados de forma idempotente e segura', () => {
      const starterSongs = [
        { id: "song_1", title: "Song 1" },
        { id: "song_2", title: "Song 2" }
      ];
      const selectedSongIds = ["song_1", "song_1", "song_2", "song_2"];
      const plan = computeStarterImportPlan({
        selectedSongIds,
        starterSongs,
        existingOrganizationGlobalIds: [],
        starterPackImportedGlobalIds: [],
        orgId: "org123"
      });
      assert.strictEqual(plan.projectedTotalCount, 2);
      assert.strictEqual(plan.songsToImport.length, 2);
    });

    it('ignora importação se o documento determinístico já existe', () => {
      const starterSongs = [
        { id: "song_1", title: "Song 1" }
      ];
      const selectedSongIds = ["song_1"];
      const deterministicId = generateDeterministicStarterSongId("org123", "song_1", "1.0");

      const plan = computeStarterImportPlan({
        selectedSongIds,
        starterSongs,
        existingOrganizationGlobalIds: [],
        starterPackImportedGlobalIds: [],
        existingDocIds: [deterministicId],
        orgId: "org123"
      });
      assert.strictEqual(plan.songsToImport.length, 0);
      assert.deepStrictEqual(plan.skippedIds, ["song_1"]);
    });

    it('estado antigo sem array é tratado corretamente', () => {
      const emptyState = {};
      const newGlobalIds = ["s1", "s2"];
      const updated = buildUpdatedOnboardingState(emptyState, newGlobalIds, "user1");
      assert.strictEqual(updated.starterPackImportedCount, 2);
      assert.deepStrictEqual(updated.starterPackImportedGlobalIds, ["s1", "s2"]);
    });

    it('transição parcial com estado antigo preenchido', () => {
      const state = {
        starterPackImportedGlobalIds: ["s1", "s2"]
      };
      const newGlobalIds = ["s3", "s4"];
      const updated = buildUpdatedOnboardingState(state, newGlobalIds, "user1");
      assert.strictEqual(updated.starterPackImportedCount, 4);
      assert.deepStrictEqual(updated.starterPackImportedGlobalIds, ["s1", "s2", "s3", "s4"]);
    });

    it('transição completa com exatamente dez músicas', () => {
      const state = {
        starterPackImportedGlobalIds: ["s1", "s2", "s3", "s4", "s5"]
      };
      const newGlobalIds = ["s6", "s7", "s8", "s9", "s10"];
      const updated = buildUpdatedOnboardingState(state, newGlobalIds, "user1");
      assert.strictEqual(updated.starterPackImportedCount, 10);
      assert.ok(updated.starterPackCompletedAt !== null);
    });

    it('décima primeira música é bloqueada por limite excedido', () => {
      const state = {
        starterPackImportedGlobalIds: ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"]
      };
      const newGlobalIds = ["s10", "s11"];
      assert.throws(() => {
        buildUpdatedOnboardingState(state, newGlobalIds, "user1");
      }, /starter_pack_limit_exceeded/);
    });

    it('normalização de importedBy e usageConsumed com preservação de links', () => {
      const rawSong = { id: "global_1", title: "Song 1", videoUrl: "http://video", chordsUrl: "http://chords" };
      const createdBy = { uid: "user_1", displayName: "Name", photoURL: null };
      const normalized = normalizeStarterSong(rawSong, "org1", createdBy, "actor_uid");

      assert.strictEqual(normalized.importedBy, "actor_uid");
      assert.strictEqual(normalized.usageConsumed, false);
      assert.strictEqual(normalized.videoUrl, "http://video");
      assert.strictEqual(normalized.chordsUrl, "http://chords");
    });
  });

  describe('Starter Entitlement and Access State Checks', () => {
    const mockDb = (orgDoc: any, subDoc: any) => ({
      collection: (collName: string) => ({
        doc: (docId: string) => ({
          get: async () => {
            if (collName === 'organizations' && docId === 'org123') {
              return {
                exists: orgDoc !== null,
                data: () => orgDoc
              };
            }
            if (collName === 'subscriptions' && docId === 'org123') {
              return {
                exists: subDoc !== null,
                data: () => subDoc
              };
            }
            return { exists: false, data: () => ({}) };
          }
        })
      })
    });

    it('entitlement sem fonte canônica resultar false', async () => {
      const db = mockDb(null, null);
      const isEntitled = await resolveStarterEntitlementState(db, 'org123');
      assert.strictEqual(isEntitled, false);
    });

    it('plano legado sem entitlement resultar false', async () => {
      const db = mockDb(
        { status: 'active', apps: { musicscale: { status: 'unsubscribed' } } },
        { status: 'unsubscribed' }
      );
      const isEntitled = await resolveStarterEntitlementState(db, 'org123');
      assert.strictEqual(isEntitled, false);
    });

    it('cancelado dentro do período canônico válido retornar true', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);
      
      const db = mockDb(
        { status: 'active', apps: { musicscale: { status: 'canceled', expiresAt: { toDate: () => futureDate } } } },
        null
      );
      const isEntitled = await resolveStarterEntitlementState(db, 'org123');
      assert.strictEqual(isEntitled, true);
    });

    it('cancelado expirado retornar false', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 24);
      
      const db = mockDb(
        { status: 'active', apps: { musicscale: { status: 'canceled', expiresAt: { toDate: () => pastDate } } } },
        null
      );
      const isEntitled = await resolveStarterEntitlementState(db, 'org123');
      assert.strictEqual(isEntitled, false);
    });

    it('organização arquivada retorna false imediatamente', async () => {
      const db = mockDb(
        { status: 'archived', apps: { musicscale: { status: 'active' } } },
        null
      );
      const isEntitled = await resolveStarterEntitlementState(db, 'org123');
      assert.strictEqual(isEntitled, false);
    });
  });
});
