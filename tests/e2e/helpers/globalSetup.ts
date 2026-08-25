import admin from 'firebase-admin';

export default async function globalSetup() {
  const reqEnvVars = [
    'FIREBASE_AUTH_EMULATOR_HOST',
    'FIRESTORE_EMULATOR_HOST',
    'GCLOUD_PROJECT',
    'GOOGLE_CLOUD_PROJECT'
  ];
  for (const v of reqEnvVars) {
    if (!process.env[v]) {
      throw new Error(`Missing required env var: ${v}`);
    }
  }
  if (process.env.GCLOUD_PROJECT !== 'demo-musicscale') {
    throw new Error('GCLOUD_PROJECT must be demo-musicscale');
  }
  
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: process.env.GCLOUD_PROJECT
    });
  }

  const db = admin.firestore();
  const auth = admin.auth();

  console.log('Clearing and seeding E2E database...');

  // Clear Firestore
  try {
    const response = await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${process.env.GCLOUD_PROJECT}/databases/(default)/documents`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to clear firestore');
  } catch (e) {
    throw new Error(`Firestore Emulator not responding or failed to clear: ${e}`);
  }

  // Clear Auth
  try {
    const response = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${process.env.GCLOUD_PROJECT}/accounts`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to clear auth');
  } catch (e) {
    throw new Error(`Auth Emulator not responding or failed to clear: ${e}`);
  }

  // Create users
  const usersToCreate = [
    { uid: 'user_leader_a', email: 'leader@orga.test', password: 'password', displayName: 'Líder Família A' },
    { uid: 'user_musician_a', email: 'musician@orga.test', password: 'password', displayName: 'Músico Família A' },
    { uid: 'user_musician_a2', email: 'musician2@orga.test', password: 'password', displayName: 'Músico A2 Família A' },
    { uid: 'user_musician_a3', email: 'musician3@orga.test', password: 'password', displayName: 'Músico A3 Família A' },
    { uid: 'user_observer_a', email: 'observer@orga.test', password: 'password', displayName: 'Observador Família A' },
    { uid: 'user_leader_b', email: 'leader@orgb.test', password: 'password', displayName: 'Líder Família B' },
    { uid: 'user_musician_b', email: 'musician@orgb.test', password: 'password', displayName: 'Músico Família B' }
  ];
  for (const u of usersToCreate) {
    try {
      await auth.createUser(u);
    } catch (e: any) {
      if (e.code === 'auth/uid-already-exists' || e.code === 'auth/email-already-exists') {
        console.warn(`User ${u.uid} already exists, skipping creation.`);
      } else {
        throw e;
      }
    }
  }

  // Create Users collection
  await db.doc('users/user_leader_a').set({ uid: 'user_leader_a', email: 'leader@orga.test', displayName: 'Líder Família A', activeOrganizationId: 'org_a', primaryOrganizationId: 'org_a' });
  await db.doc('users/user_leader_b').set({ uid: 'user_leader_b', email: 'leader@orgb.test', displayName: 'Líder Família B', activeOrganizationId: 'org_b', primaryOrganizationId: 'org_b' });
  await db.doc('users/user_musician_a').set({ uid: 'user_musician_a', email: 'musician@orga.test', displayName: 'Músico Família A', activeOrganizationId: 'org_a', primaryOrganizationId: 'org_a' });
  await db.doc('users/user_musician_a2').set({ uid: 'user_musician_a2', email: 'musician2@orga.test', displayName: 'Músico A2 Família A', activeOrganizationId: 'org_a', primaryOrganizationId: 'org_a' });
  await db.doc('users/user_musician_a3').set({ uid: 'user_musician_a3', email: 'musician3@orga.test', displayName: 'Músico A3 Família A', activeOrganizationId: 'org_a', primaryOrganizationId: 'org_a' });
  await db.doc('users/user_observer_a').set({ uid: 'user_observer_a', email: 'observer@orga.test', displayName: 'Observador Família A', activeOrganizationId: 'org_a', primaryOrganizationId: 'org_a' });
  await db.doc('users/user_musician_b').set({ uid: 'user_musician_b', email: 'musician@orgb.test', displayName: 'Músico Família B', activeOrganizationId: 'org_b', primaryOrganizationId: 'org_b' });

  // Organization A
  await db.doc('organizations/org_a').set({
    name: 'Família Teste A',
    ownerUid: 'user_leader_a',
    ownerUserId: 'user_leader_a',
    status: 'active',
    archived: false,
    plan: 'premium',
    featureFlags: {
      "musicscale.musicScalePublishCommandV1": true,
      "musicscale.scaleResponsesV1": true
    },
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
    featureFlags: {
      "musicscale.musicScalePublishCommandV1": true,
      "musicscale.scaleResponsesV1": true
    },
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
  futureDate.setUTCDate(futureDate.getUTCDate() + 30);
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
  await db.doc('organizations/org_a/members/user_leader_a').set({ uid: 'user_leader_a', userId: 'user_leader_a', organizationId: 'org_a', status: 'active', role: 'admin', organizationRole: 'admin', email: 'leader@orga.test', displayName: 'Líder A' });
  await db.doc('organizations/org_a/members/user_musician_a').set({ uid: 'user_musician_a', userId: 'user_musician_a', organizationId: 'org_a', status: 'active', role: 'member', organizationRole: 'member', email: 'musician@orga.test', displayName: 'Musico A' });
  await db.doc('organizations/org_a/members/user_musician_a2').set({ uid: 'user_musician_a2', userId: 'user_musician_a2', organizationId: 'org_a', status: 'active', role: 'member', organizationRole: 'member', email: 'musician2@orga.test', displayName: 'Musico A2' });
  await db.doc('organizations/org_a/members/user_musician_a3').set({ uid: 'user_musician_a3', userId: 'user_musician_a3', organizationId: 'org_a', status: 'active', role: 'member', organizationRole: 'member', email: 'musician3@orga.test', displayName: 'Musico A3' });
  await db.doc('organizations/org_a/members/user_observer_a').set({ uid: 'user_observer_a', userId: 'user_observer_a', organizationId: 'org_a', status: 'active', role: 'visitor', organizationRole: 'visitor', email: 'observer@orga.test', displayName: 'Observador A' });

  // Global members mapping for A
  await db.doc('organization_members/user_leader_a_org_a').set({ uid: 'user_leader_a', userId: 'user_leader_a', organizationId: 'org_a', status: 'active', role: 'admin', organizationRole: 'admin' });
  await db.doc('organization_members/user_musician_a_org_a').set({ uid: 'user_musician_a', userId: 'user_musician_a', organizationId: 'org_a', status: 'active', role: 'member', organizationRole: 'member' });
  await db.doc('organization_members/user_musician_a2_org_a').set({ uid: 'user_musician_a2', userId: 'user_musician_a2', organizationId: 'org_a', status: 'active', role: 'member', organizationRole: 'member' });
  await db.doc('organization_members/user_musician_a3_org_a').set({ uid: 'user_musician_a3', userId: 'user_musician_a3', organizationId: 'org_a', status: 'active', role: 'member', organizationRole: 'member' });
  await db.doc('organization_members/user_observer_a_org_a').set({ uid: 'user_observer_a', userId: 'user_observer_a', organizationId: 'org_a', status: 'active', role: 'visitor', organizationRole: 'visitor' });

  // Members Org B
  await db.doc('organizations/org_b/members/user_leader_b').set({ uid: 'user_leader_b', userId: 'user_leader_b', organizationId: 'org_b', status: 'active', role: 'admin', organizationRole: 'admin', email: 'leader@orgb.test', displayName: 'Líder B' });
  await db.doc('organizations/org_b/members/user_musician_b').set({ uid: 'user_musician_b', userId: 'user_musician_b', organizationId: 'org_b', status: 'active', role: 'member', organizationRole: 'member', email: 'musician@orgb.test', displayName: 'Musico B' });
  await db.doc('organization_members/user_leader_b_org_b').set({ uid: 'user_leader_b', userId: 'user_leader_b', organizationId: 'org_b', status: 'active', role: 'admin', organizationRole: 'admin' });
  await db.doc('organization_members/user_musician_b_org_b').set({ uid: 'user_musician_b', userId: 'user_musician_b', organizationId: 'org_b', status: 'active', role: 'member', organizationRole: 'member' });

  // Events/locations/etc Org A
  await db.doc('eventTypes/type_a').set({ organizationId: 'org_a', name: 'Culto Principal', active: true });
  await db.doc('locations/loc_a').set({ organizationId: 'org_a', name: 'Templo Sede', active: true });
  await db.doc('eventNames/name_a').set({ organizationId: 'org_a', name: 'Evento Especial A', active: true });

  // Instruments/Functions Org A
  await db.doc('instruments/instrument_vocal').set({ organizationId: 'org_a', name: 'Vocal', category: 'Voz', active: true });
  await db.doc('instruments/instrument_guitar').set({ organizationId: 'org_a', name: 'Violão', category: 'Instrumento', active: true });
  await db.doc('instruments/instrument_keyboard').set({ organizationId: 'org_a', name: 'Teclado', category: 'Instrumento', active: true });

  // Events/locations/etc Org B
  await db.doc('eventTypes/type_b').set({ organizationId: 'org_b', name: 'Reunião Jovem', active: true });
  await db.doc('locations/loc_b').set({ organizationId: 'org_b', name: 'Anexo', active: true });

  // Songs Org A
  await db.doc('songs/song_a_1').set({
    organizationId: 'org_a',
    title: 'Música Sintética',
    artist: 'Artista Teste',
    tone: 'C',
    key: 'C',
    originalKey: 'C',
    bpm: 120,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'user_leader_a'
  });
  
  await db.doc('songs/song_a_2').set({
    organizationId: 'org_a',
    title: 'Outra Música',
    artist: 'Artista Teste',
    tone: 'D',
    key: 'D',
    originalKey: 'D',
    bpm: 90,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'user_leader_a'
  });

  // Song Org B
  await db.doc('songs/song_b_1').set({
    organizationId: 'org_b',
    title: 'Música da Org B',
    artist: 'Artista B',
    tone: 'G',
    key: 'G',
    originalKey: 'G',
    bpm: 100,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'user_leader_b'
  });

  // Scales Org A
  const scaleDate = new Date();
  scaleDate.setUTCDate(scaleDate.getUTCDate() + 7);
  await db.doc('scales/scale_a_published').set({
    organizationId: 'org_a',
    title: 'Culto de Domingo',
    date: scaleDate.toISOString().split('T')[0],
    time: '19:00',
    startTime: '19:00',
    status: 'published',
    songIds: ['song_a_1'],
    eventTypeId: 'type_a',
    locationId: 'loc_a',
    eventNameId: 'name_a',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'user_leader_a'
  });
  
  await db.doc('scales/scale_a_draft').set({
    organizationId: 'org_a',
    title: 'Culto de Terça',
    date: scaleDate.toISOString().split('T')[0],
    time: '19:30',
    startTime: '19:30',
    status: 'draft',
    songIds: ['song_a_1', 'song_a_2'],
    songSettings: {
      'song_a_1': { key: 'C', bpm: 120, scope: 'global' },
      'song_a_2': { key: 'D', bpm: 90, scope: 'global' }
    },
    eventTypeId: 'type_a',
    locationId: 'loc_a',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'user_leader_a'
  });

  // Project-specific replicates for isolation
  const projects = ['desktop-chromium', 'mobile-chromium', 'mobile-webkit', 'tablet-webkit'];
  for (const p of projects) {
    await db.doc(`scales/scale_a_published_${p}`).set({
      organizationId: 'org_a',
      title: `Culto de Domingo ${p}`,
      date: scaleDate.toISOString().split('T')[0],
      time: '19:00',
      startTime: '19:00',
      status: 'published',
      songIds: ['song_a_1'],
      eventTypeId: 'type_a',
      locationId: 'loc_a',
      eventNameId: 'name_a',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'user_leader_a'
    });

    // E2E 10 Draft Scale
    await db.doc(`scales/scale_song_persistence_${p}`).set({
      organizationId: 'org_a',
      title: `Persistência de Tom ${p}`,
      date: scaleDate.toISOString().split('T')[0],
      time: '19:30',
      startTime: '19:30',
      status: 'draft',
      songIds: ['song_a_1', 'song_a_2'],
      songSettings: {
        'song_a_1': { key: 'C', bpm: 120, scope: 'global' },
        'song_a_2': { key: 'D', bpm: 90, scope: 'global' }
      },
      eventTypeId: 'type_a',
      locationId: 'loc_a',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'user_leader_a'
    });

    // E2E 11 Draft Scale
    await db.doc(`scales/scale_full_cycle_${p}`).set({
      organizationId: 'org_a',
      title: `Ciclo Completo ${p}`,
      date: scaleDate.toISOString().split('T')[0],
      time: '19:30',
      startTime: '19:30',
      status: 'draft',
      songIds: ['song_a_1', 'song_a_2'],
      songSettings: {
        'song_a_1': { key: 'C', bpm: 120, scope: 'global' },
        'song_a_2': { key: 'D', bpm: 90, scope: 'global' }
      },
      eventTypeId: 'type_a',
      locationId: 'loc_a',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'user_leader_a'
    });

    // E2E 11 Band Scale
    await db.doc(`bandScales/bandscale_full_cycle_${p}`).set({
      organizationId: 'org_a',
      date: scaleDate.toISOString().split('T')[0],
      time: '19:30',
      assignments: [
        { id: `assign_fc_1_${p}`, userId: 'user_musician_a', instrumentId: 'instrument_vocal' },
        { id: `assign_fc_2_${p}`, userId: 'user_musician_a2', instrumentId: 'instrument_guitar' }
      ],
      eventTypeId: 'type_a',
      locationId: 'loc_a',
      createdBy: { uid: 'user_leader_a', displayName: 'Líder A', photoURL: null },
      createdAt: admin.firestore.Timestamp.now().toDate().toISOString()
    });

    await db.doc(`organizations/org_a/notifications/notif_musician_a_${p}`).set({
      recipientId: 'user_musician_a',
      organizationId: 'org_a',
      type: 'scale_published',
      title: 'Nova escala publicada',
      message: `Culto de Terça ${p}`,
      link: `/scales/scale_a_published_${p}`,
      isRead: false,
      isArchived: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // Scale Org B
  await db.doc('scales/scale_b_published').set({
    organizationId: 'org_b',
    title: 'Escala da Org B',
    date: scaleDate.toISOString().split('T')[0],
    time: '20:00',
    startTime: '20:00',
    status: 'published',
    songIds: ['song_b_1'],
    eventTypeId: 'type_b',
    locationId: 'loc_b',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'user_leader_b'
  });

  // BandScale Org A
  await db.doc('bandScales/bandscale_a').set({
    organizationId: 'org_a',
    date: scaleDate.toISOString().split('T')[0],
    time: '19:30',
    assignments: [
      { id: 'assign_1', userId: 'user_musician_a', instrumentId: 'instrument_vocal' },
      { id: 'assign_2', userId: 'user_musician_a2', instrumentId: 'instrument_guitar' }
    ],
    eventTypeId: 'type_a',
    locationId: 'loc_a',
    createdBy: { uid: 'user_leader_a', displayName: 'Líder A', photoURL: null },
    createdAt: admin.firestore.Timestamp.now().toDate().toISOString()
  });

  // Notifications
  await db.doc('organizations/org_a/notifications/notif_a').set({
    recipientId: 'user_leader_a',
    organizationId: 'org_a',
    type: 'scale_published',
    title: 'Nova notificação sintética',
    message: 'Teste E2E',
    link: '/dashboard',
    isRead: false,
    isArchived: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await db.doc('organizations/org_a/notifications/notif_musician_a').set({
    recipientId: 'user_musician_a',
    organizationId: 'org_a',
    type: 'scale_published',
    title: 'Nova escala publicada',
    message: 'Culto de Terça',
    link: '/scales/scale_a_published',
    isRead: false,
    isArchived: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await db.doc('organizations/org_b/notifications/notif_b').set({
    recipientId: 'user_leader_b',
    type: 'scale_published',
    title: 'Notificação Org B',
    message: 'Teste E2E B',
    link: '/dashboard',
    isRead: false,
    isArchived: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Validation Check
  const scalesASnaps = await db.collection('scales').where('organizationId', '==', 'org_a').get();
  if (scalesASnaps.size < 2) throw new Error("Seed verification failed for scales A");
  
  const scalesBSnaps = await db.collection('scales').where('organizationId', '==', 'org_b').get();
  if (scalesBSnaps.size !== 1) throw new Error("Seed verification failed for scales B");

  console.log('E2E database seeding complete.');
}
