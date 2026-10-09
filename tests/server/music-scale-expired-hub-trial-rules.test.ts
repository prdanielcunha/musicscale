import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let env: RulesTestEnvironment;
const now = () => Date.now();
const DAY = 86_400_000;
const owned = (suffix = '') => env.authenticatedContext('owner').firestore();
const readPath = async (path: string) => getDoc(doc(owned(), path));
const paths = ['songs/song-1', 'scales/scale-1', 'bandScales/band-1', 'fixedBandScales/fixed-1',
  'liveSessions/live-1', 'roles/role-1', 'organizations/org-1/musicscale_members/owner'];
async function seed(options: {
  trialSource?: boolean; endsInDays?: number; startOffsetDays?: number;
  extensionDays?: number; paidMusic?: boolean; nestLocalOnly?: boolean;
  tamperDuration?: boolean;
} = {}) {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const org = {
      status:'active',ownerUid:'owner',
      apps:{musicscale:options.trialSource ? {
        status:'trialing',trialSource:'hub_internal_trial',trialUsed:true,trialEndsAt:Timestamp.fromMillis(now() + (options.endsInDays ?? 12)*DAY),
      } : {status:'active'}}
    };
    await setDoc(doc(db,'organizations/org-1'), org);
    await setDoc(doc(db,'organizations/org-1/members/owner'),{
      uid:'owner',organizationId:'org-1',status:'active',role:'owner',organizationRole:'owner',
      permissions:{canManageScales:true,canManageRepertoire:true,canManageRoles:true}
    });
    await setDoc(doc(db,'organizations/org-1/musicscale_members/owner'),{uid:'owner',organizationId:'org-1',roleId:'role-1'});
    for(const path of paths.filter(path => !path.includes('musicscale_members'))) {
      await setDoc(doc(db,path),{organizationId:'org-1',name:'fixture',userId:'owner'});
    }
    await setDoc(doc(db,'organizations/org-1/notes/entry'), {organizationId:'org-1',text:'musical note'});
    await setDoc(doc(db,'scales/scale-1/responses/owner'),{organizationId:'org-1',userId:'owner',status:'accepted'});
    if(options.trialSource){
      const end = now() + (options.endsInDays ?? 12)*DAY;
      const start = end - (options.tamperDuration ? 13 : 14)*DAY;
      await setDoc(doc(db,'musicscale_internal_trials/org-1'),{
        appId:'musicscale',organizationId:'org-1',ownerUid:'owner',
        source:'hub_internal_trial',status:'active',revoked:false,
        consumed:true,grantVersion:2,beginsAt:Timestamp.fromMillis(start),
        expiresAt:Timestamp.fromMillis(end),
        ...(options.extensionDays ? {
          extensionCount:1,extensionDays:options.extensionDays,
          extensionEndsAt:Timestamp.fromMillis(end+options.extensionDays*DAY),
        } : {})
      });
    }
    if(options.paidMusic) {
      await setDoc(doc(db,'subscriptions/org-1'),{
        apps:{musicscale:{status:'active',stripeSubscriptionId:'sub_music_valid'}},
      });
    }
    if(options.nestLocalOnly) {
      await setDoc(doc(db,'subscriptions/org-1'),{
        status:'active',stripeSubscriptionId:'sub_nestlocal',
        apps:{nestlocal:{status:'active',stripeSubscriptionId:'sub_nestlocal'}},
      });
    }
  });
}

beforeAll(async()=>{
  if(!hasEmulator)return;
  env=await initializeTestEnvironment({
    projectId:'demo-musicscale-hub-trial-denial',
    firestore:{rules:readFileSync(resolve(process.cwd(),'firestore.rules'),'utf8')}
  });
},30_000);
beforeEach(async()=>{if(hasEmulator)await env.clearFirestore()});
afterAll(async()=>{if(hasEmulator)await env.cleanup()});

describe.skipIf(!hasEmulator)('Hub no-card MusicScale Firestore expiry policy',()=>{
  it('does not regress an unmarked legacy organization',async()=>{
    await seed();
    for(const path of paths)await assertSucceeds(readPath(path));
    await assertSucceeds(readPath('organizations/org-1/notes/entry'));
  });

  it('allows verified active 14-day Hub grant without any Stripe checkout',async()=>{
    await seed({trialSource:true,endsInDays:12});
    for(const path of paths)await assertSucceeds(readPath(path));
    await assertSucceeds(readPath('scales/scale-1/responses/owner'));
  });

  it('denies every tested musical read after a Hub trial expires',async()=>{
    await seed({trialSource:true,endsInDays:-1});
    for(const path of paths)await assertFails(readPath(path));
    await assertFails(readPath('organizations/org-1/notes/entry'));
    await assertFails(readPath('scales/scale-1/responses/owner'));
    await assertFails(updateDoc(doc(owned(),'songs/song-1'),{name:'overwrite'}));
    // Billing/identity shell still needs the organization record.
    await assertSucceeds(readPath('organizations/org-1'));
  });

  it('does not mistake a paid NestLocal subscription for MusicScale',async()=>{
    await seed({trialSource:true,endsInDays:-1,nestLocalOnly:true});
    await assertFails(readPath('songs/song-1'));
    await assertFails(readPath('scales/scale-1'));
  });

  it('a proven active MusicScale paid subscription restores same tenant',async()=>{
    await seed({trialSource:true,endsInDays:-1,paidMusic:true});
    await assertSucceeds(readPath('songs/song-1'));
    await assertSucceeds(readPath('fixedBandScales/fixed-1'));
  });

  it('permits one verified extension with effective deadline still in future',async()=>{
    await seed({trialSource:true,endsInDays:-1,extensionDays:7});
    await assertSucceeds(readPath('songs/song-1'));
    await assertSucceeds(readPath('scales/scale-1'));
  });

  it('rejects malformed 14-day grants even with matching tenant metadata',async()=>{
    await seed({trialSource:true,endsInDays:12,tamperDuration:true});
    await assertFails(readPath('songs/song-1'));
  });

  it('does not allow an owner to strip or forge Hub trial metadata',async()=>{
    await seed({trialSource:true,endsInDays:-1});
    await assertFails(updateDoc(doc(owned(),'organizations/org-1'),{
      'apps.musicscale.trialSource':'',
    }));
    await assertFails(updateDoc(doc(owned(),'organizations/org-1'),{
      'apps.musicscale.trialEndsAt':Timestamp.fromMillis(now()+30*DAY),
    }));
    await assertFails(setDoc(doc(owned(),'organizations/org-1/app_entitlements/musicscale'),{
      canRead:true,canWrite:true,source:'hub_internal_trial'
    }));
  });

  it('keeps cross-tenant data private independent of trial status',async()=>{
    await seed({trialSource:true,endsInDays:12});
    await assertFails(getDoc(doc(env.authenticatedContext('outside').firestore(),'songs/song-1')));
  });
});
