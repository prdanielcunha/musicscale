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

  console.log('Clearing and seeding E2E database...');

  // Note: For clearing, we can use the emulator hub REST API if necessary, 
  // or simply delete known documents. We'll rely on the emulator being fresh in CI,
  // but if needed, we'll just overwrite. We will delete collections from localhost:8080 if we can.
  try {
    await fetch(`http://127.0.0.1:8080/emulator/v1/projects/demo-musicscale/databases/(default)/documents`, {
      method: 'DELETE',
    });
  } catch (e) {
    console.log("Could not clear database via REST (might not be running or supported), proceeding...");
  }

  // Create users
  try {
    await auth.createUser({ uid: 'user_leader_a', email: 'leader@orga.test', password: 'password', displayName: 'Líder Família A' });
  } catch (e: any) { if (e.code !== 'auth/uid-already-exists') throw e; }
  
  try {
    await auth.createUser({ uid: 'user_musician_a', email: 'musician@orga.test', password: 'password', displayName: 'Músico Família A' });
  } catch (e: any) { if (e.code !== 'auth/uid-already-exists') throw e; }
  
  try {
    await auth.createUser({ uid: 'user_observer_a', email: 'observer@orga.test', password: 'password', displayName: 'Observador Família A' });
  } catch (e: any) { if (e.code !== 'auth/uid-already-exists') throw e; }
    
  try {
    await auth.createUser({ uid: 'user_leader_b', email: 'leader@orgb.test', password: 'password', displayName: 'Líder Família B' });
  } catch (e: any) { if (e.code !== 'auth/uid-already-exists') throw e; }

  // Create Users collection
  await db.doc('users/user_leader_a').set({ uid: 'user_leader_a', email: 'leader@orga.test', displayName: 'Líder Família A', activeOrganizationId: 'org_a', primaryOrganizationId: 'org_a' });
  await db.doc('users/user_leader_b').set({ uid: 'user_leader_b', email: 'leader@orgb.test', displayName: 'Líder Família B', activeOrganizationId: 'org_b', primaryOrganizationId: 'org_b' });
  await db.doc('users/user_musician_a').set({ uid: 'user_musician_a', email: 'musician@orga.test', displayName: 'Músico Família A', activeOrganizationId: 'org_a', primaryOrganizationId: 'org_a' });
  await db.doc('users/user_observer_a').set({ uid: 'user_observer_a', email: 'observer@orga.test', displayName: 'Observador Família A', activeOrganizationId: 'org_a', primaryOrganizationId: 'org_a' });

  // Organization A
  await db.doc('organizations/org_a').set({
    name: 'Família Teste A',
    ownerUid: 'user_leader_a',
    ownerUserId: 'user_leader_a',
    status: 'active',
    archived: false,
    plan: 'premium',
    apps: {
      musicscale: {
        status: 'active',
        plan: 'premium',
        features: {}
      }
    }
  });

  // Organization B
  await db.doc('organizations/org_b').set({
    name: 'Família Teste B',
    ownerUid: 'user_leader_b',
    ownerUserId: 'user_leader_b',
    status: 'active',
    archived: false,
    plan: 'premium',
    apps: {
      musicscale: {
        status: 'active',
        plan: 'premium',
        features: {}
      }
    }
  });

  // Subscriptions
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const currentPeriodEnd = admin.firestore.Timestamp.fromDate(futureDate);
  
  await db.doc('subscriptions/org_a').set({
    status: 'active',
    plan: 'pro',
    currentPeriodEnd
  });

  await db.doc('subscriptions/org_b').set({
    status: 'active',
    plan: 'pro',
    currentPeriodEnd
  });

  // Members Org A
  await db.doc('organizations/org_a/members/user_leader_a').set({ uid: 'user_leader_a', userId: 'user_leader_a', organizationId: 'org_a', status: 'active', role: 'admin', organizationRole: 'admin', email: 'leader@orga.test' });
  await db.doc('organizations/org_a/members/user_musician_a').set({ uid: 'user_musician_a', userId: 'user_musician_a', organizationId: 'org_a', status: 'active', role: 'member', organizationRole: 'member', email: 'musician@orga.test' });
  await db.doc('organizations/org_a/members/user_observer_a').set({ uid: 'user_observer_a', userId: 'user_observer_a', organizationId: 'org_a', status: 'active', role: 'visitor', organizationRole: 'visitor', email: 'observer@orga.test' });

  // Global members mapping for A
  await db.doc('organization_members/user_leader_a_org_a').set({ uid: 'user_leader_a', userId: 'user_leader_a', organizationId: 'org_a', status: 'active', role: 'admin', organizationRole: 'admin' });
  await db.doc('organization_members/user_musician_a_org_a').set({ uid: 'user_musician_a', userId: 'user_musician_a', organizationId: 'org_a', status: 'active', role: 'member', organizationRole: 'member' });
  await db.doc('organization_members/user_observer_a_org_a').set({ uid: 'user_observer_a', userId: 'user_observer_a', organizationId: 'org_a', status: 'active', role: 'visitor', organizationRole: 'visitor' });

  // Members Org B
  await db.doc('organizations/org_b/members/user_leader_b').set({ uid: 'user_leader_b', userId: 'user_leader_b', organizationId: 'org_b', status: 'active', role: 'admin', organizationRole: 'admin', email: 'leader@orgb.test' });
  await db.doc('organization_members/user_leader_b_org_b').set({ uid: 'user_leader_b', userId: 'user_leader_b', organizationId: 'org_b', status: 'active', role: 'admin', organizationRole: 'admin' });


  // Add songs to root collection (filtered by organizationId)
  await db.doc('songs/song_1').set({
    organizationId: 'org_a',
    title: 'Música Sintética',
    artist: 'Artista Teste',
    tone: 'C',
    bpm: 120,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'user_leader_a'
  });
  
  await db.doc('songs/song_2').set({
    organizationId: 'org_a',
    title: 'Outra Música',
    artist: 'Artista Teste',
    tone: 'D',
    bpm: 90,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'user_leader_a'
  });

  // Add scale for Org A
  const scaleDate = new Date();
  scaleDate.setDate(scaleDate.getDate() + 7);
  await db.doc('scales/scale_future').set({
    organizationId: 'org_a',
    title: 'Culto de Domingo',
    date: scaleDate.toISOString().split('T')[0],
    time: '19:00',
    startTime: '19:00',
    status: 'published',
    songIds: ['song_1'],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'user_leader_a'
  });
  
  await db.doc('scales/scale_draft').set({
    organizationId: 'org_a',
    title: 'Culto de Terça',
    date: scaleDate.toISOString().split('T')[0],
    time: '19:30',
    startTime: '19:30',
    status: 'draft',
    songIds: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'user_leader_a'
  });

  // Events/locations/etc
  await db.doc('eventTypes/type_1').set({
    organizationId: 'org_a',
    name: 'Culto Principal',
    active: true
  });

  await db.doc('locations/loc_1').set({
    organizationId: 'org_a',
    name: 'Templo Sede',
    active: true
  });

  // Notifications
  await db.doc('notifications/notif_1').set({
    organizationId: 'org_a',
    userId: 'user_leader_a',
    title: 'Nova notificação sintética',
    body: 'Teste E2E',
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('E2E database seeding complete.');
}
