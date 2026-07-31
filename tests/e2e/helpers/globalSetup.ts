import admin from 'firebase-admin';

export default async function globalSetup() {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.GCLOUD_PROJECT = 'demo-musicscale'; // Required by emulator

  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: 'demo-musicscale'
    });
  }

  const db = admin.firestore();
  const auth = admin.auth();

  console.log('Seeding E2E database...');

  // Create users
  try {
    await auth.createUser({ uid: 'user_leader_a', email: 'leader@orga.test', password: 'password', displayName: 'Líder Família A' });
    await auth.createUser({ uid: 'user_musician_a', email: 'musician@orga.test', password: 'password', displayName: 'Músico Família A' });
    await auth.createUser({ uid: 'user_observer_a', email: 'observer@orga.test', password: 'password', displayName: 'Observador Família A' });
    
    await auth.createUser({ uid: 'user_leader_b', email: 'leader@orgb.test', password: 'password', displayName: 'Líder Família B' });
  } catch (e: any) {
    if (e.code !== 'auth/uid-already-exists') throw e;
  }

  // Create Users collection
  await db.doc('users/user_leader_a').set({ uid: 'user_leader_a', email: 'leader@orga.test', displayName: 'Líder Família A', activeOrganizationId: 'org_a' });
  await db.doc('users/user_leader_b').set({ uid: 'user_leader_b', email: 'leader@orgb.test', displayName: 'Líder Família B', activeOrganizationId: 'org_b' });
  await db.doc('users/user_musician_a').set({ uid: 'user_musician_a', email: 'musician@orga.test', displayName: 'Músico Família A', activeOrganizationId: 'org_a' });

  // Organization A
  await db.doc('organizations/org_a').set({
    name: 'Família Teste A',
    ownerUid: 'user_leader_a',
    status: 'active',
    plan: 'premium'
  });

  // Members Org A
  await db.doc('organizations/org_a/members/user_leader_a').set({ uid: 'user_leader_a', role: 'admin' });
  await db.doc('organizations/org_a/members/user_musician_a').set({ uid: 'user_musician_a', role: 'member' });
  await db.doc('organizations/org_a/members/user_observer_a').set({ uid: 'user_observer_a', role: 'visitor' });

  // Global members mapping for A
  await db.doc('organization_members/user_leader_a_org_a').set({ uid: 'user_leader_a', organizationId: 'org_a', role: 'admin' });
  await db.doc('organization_members/user_musician_a_org_a').set({ uid: 'user_musician_a', organizationId: 'org_a', role: 'member' });

  // Organization B
  await db.doc('organizations/org_b').set({
    name: 'Família Teste B',
    ownerUid: 'user_leader_b',
    status: 'active',
    plan: 'premium'
  });
  await db.doc('organizations/org_b/members/user_leader_b').set({ uid: 'user_leader_b', role: 'admin' });
  await db.doc('organization_members/user_leader_b_org_b').set({ uid: 'user_leader_b', organizationId: 'org_b', role: 'admin' });

  // Add a synthetic song for Org A
  await db.doc('organizations/org_a/songs/song_1').set({
    title: 'Música Sintética',
    artist: 'Artista Teste',
    tone: 'C',
    bpm: 120,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Add a scale for Org A
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  await db.doc('organizations/org_a/scales/scale_future').set({
    title: 'Culto de Domingo',
    date: futureDate.toISOString().split('T')[0],
    time: '19:00',
    status: 'published',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('E2E database seeding complete.');
}
