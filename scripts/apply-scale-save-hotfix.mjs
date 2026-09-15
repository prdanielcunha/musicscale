import fs from 'node:fs';

const replaceExact = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Expected ${label} block not found; refusing blind patch.`);
  return source.replace(before, after);
};

const rulesPath = 'firestore.rules';
let rules = fs.readFileSync(rulesPath, 'utf8');
const oldSystemAdmin = `    function isSystemAdmin() {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('systemRole', '') in
          ['ceo', 'admin', 'global_admin', 'ecosystem_owner', 'founder'];
    }`;
const newSystemAdmin = `    function isCanonicalGlobalSystemRole(role) {
      return role in ['ceo', 'admin', 'global_admin', 'ecosystem_owner', 'founder'];
    }

    function isSystemAdmin() {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        (
          isCanonicalGlobalSystemRole(get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('systemRole', '')) ||
          isCanonicalGlobalSystemRole(get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('ecosystemRole', '')) ||
          isCanonicalGlobalSystemRole(get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('globalRole', ''))
        );
    }`;
rules = replaceExact(rules, oldSystemAdmin, newSystemAdmin, 'isSystemAdmin');
fs.writeFileSync(rulesPath, rules);

const modalPath = 'contexts/ModalContext.tsx';
let modal = fs.readFileSync(modalPath, 'utf8');
const oldSilentReturn = `    if (!user || !userProfile || !api) {
        logger.error("Cannot save scale: user, userProfile or api is missing", { user: !!user, userProfile: !!userProfile, api: !!api });
        return;
    }`;
const newVisibleFailure = `    if (!user || !userProfile || !api) {
        logger.error("Cannot save scale: user, userProfile or api is missing", { user: !!user, userProfile: !!userProfile, api: !!api });
        toast({
            type: 'error',
            message: t('common.errorSaving', "Erro ao salvar"),
            description: t('scaleModal.saveContextUnavailable')
        });
        return;
    }`;
modal = replaceExact(modal, oldSilentReturn, newVisibleFailure, 'scale-save silent guard');
fs.writeFileSync(modalPath, modal);

const translations = {
  'locales/pt.json': 'Sua sessão ou organização ainda não terminou de carregar. Aguarde alguns segundos e tente salvar novamente.',
  'locales/en.json': 'Your session or organization is still loading. Wait a few seconds and try saving again.',
  'locales/es.json': 'Tu sesión u organización todavía se está cargando. Espera unos segundos e intenta guardar nuevamente.',
};
for (const [file, message] of Object.entries(translations)) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!json.scaleModal || typeof json.scaleModal !== 'object') throw new Error(`Missing scaleModal dictionary in ${file}`);
  json.scaleModal.saveContextUnavailable = message;
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '0.1.1-beta';
const regression = 'vitest run tests/server/music-scale-global-role-save.test.ts';
if (!String(pkg.scripts['test:emulator:security']).includes('music-scale-global-role-save.test.ts')) {
  pkg.scripts['test:emulator:security'] += ` && ${regression}`;
}
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
lock.version = '0.1.1-beta';
if (lock.packages?.['']) lock.packages[''].version = '0.1.1-beta';
fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');

fs.writeFileSync('tests/server/music-scale-global-role-save.test.ts', `import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const describeWithEmulator = hasEmulator ? describe : describe.skip;
let env: RulesTestEnvironment;

describeWithEmulator('MusicScale scale-save global role compatibility', () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-musicscale-global-role-save',
      firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') },
    });
  });

  afterAll(async () => { await env?.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'organizations', 'org-1'), {
        status: 'active', ownerUid: 'tenant-owner',
      });
    });
  });

  const seedUser = async (uid: string, data: Record<string, unknown>) => {
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users', uid), data);
    });
  };

  const createMusicScale = (uid: string, id: string) => {
    const db = env.authenticatedContext(uid).firestore();
    return setDoc(doc(db, 'scales', id), {
      organizationId: 'org-1',
      date: '2026-09-20',
      time: '19:00',
      timeZone: 'America/Sao_Paulo',
      eventTypeId: 'event-1',
      locationId: 'location-1',
      songIds: ['song-1'],
      durationMinutes: 90,
      status: 'draft',
    });
  };

  const createBandScale = (uid: string, id: string) => {
    const db = env.authenticatedContext(uid).firestore();
    return setDoc(doc(db, 'bandScales', id), {
      organizationId: 'org-1',
      date: '2026-09-20',
      assignments: [{ userId: 'member-1', instrumentId: 'instrument-1' }],
    });
  };

  it('allows CEO carried in ecosystemRole to create music and band scales', async () => {
    await seedUser('ceo-ecosystem', { ecosystemRole: 'ceo' });
    await assertSucceeds(createMusicScale('ceo-ecosystem', 'scale-eco-ceo'));
    await assertSucceeds(createBandScale('ceo-ecosystem', 'band-eco-ceo'));
  });

  it('allows CEO carried in globalRole to create a music scale', async () => {
    await seedUser('ceo-global', { globalRole: 'ceo' });
    await assertSucceeds(createMusicScale('ceo-global', 'scale-global-ceo'));
  });

  it('preserves the canonical systemRole CEO path', async () => {
    await seedUser('ceo-system', { systemRole: 'ceo' });
    await assertSucceeds(createMusicScale('ceo-system', 'scale-system-ceo'));
  });

  it('does not turn an ordinary member into a scale manager', async () => {
    await seedUser('ordinary-member', { systemRole: 'user' });
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'organizations', 'org-1', 'members', 'ordinary-member'), {
        status: 'active', organizationRole: 'member',
      });
    });
    await assertFails(createMusicScale('ordinary-member', 'scale-forbidden'));
  });

  it('allows an active member with explicit canManageScales permission', async () => {
    await seedUser('scale-manager', { systemRole: 'user' });
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'organizations', 'org-1', 'members', 'scale-manager'), {
        status: 'active',
        organizationRole: 'member',
        permissions: { canManageScales: true },
      });
    });
    await assertSucceeds(createMusicScale('scale-manager', 'scale-explicit-permission'));
  });
});
`);

fs.writeFileSync('tests/unit/scale-save-no-silent-failure.test.ts', `import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('scale save failure feedback contract', () => {
  it('never silently returns when auth/profile/API context is unavailable', () => {
    const source = readFileSync(resolve(process.cwd(), 'contexts/ModalContext.tsx'), 'utf8');
    const start = source.indexOf('if (!user || !userProfile || !api)');
    expect(start).toBeGreaterThan(-1);
    const block = source.slice(start, start + 650);
    expect(block).toContain('toast({');
    expect(block).toContain("scaleModal.saveContextUnavailable");
  });
});
`);

console.log('Scale-save hotfix patch applied.');
