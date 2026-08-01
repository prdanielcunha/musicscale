import admin from 'firebase-admin';

function getDb() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST is not set. Emulator assertions must only run with emulator.');
  }
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: process.env.GCLOUD_PROJECT || 'demo-musicscale'
    });
  }
  return admin.firestore();
}

export async function getScaleSnapshot(scaleId: string): Promise<any> {
  const db = getDb();
  const doc = await db.collection('scales').doc(scaleId).get();
  return doc.exists ? doc.data() : null;
}

export async function getScaleResponses(scaleId: string): Promise<any[]> {
  const db = getDb();
  const snap = await db.collection('scales').doc(scaleId).collection('responses').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getOrganizationNotifications(orgId: string): Promise<any[]> {
  const db = getDb();
  const snap = await db.collection('organizations').doc(orgId).collection('notifications').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getBandScaleSnapshot(bandScaleId: string): Promise<any> {
  const db = getDb();
  const doc = await db.collection('bandScales').doc(bandScaleId).get();
  return doc.exists ? doc.data() : null;
}

export async function countNotificationsForScale(orgId: string, scaleId: string) {
  const notifs = await getOrganizationNotifications(orgId);
  return notifs.filter((n: any) => n.sourceEventId === scaleId || n.metadata?.musicScaleId === scaleId).length;
}

export async function countActiveAssignments(scaleId: string) {
  const scale = await getScaleSnapshot(scaleId);
  if (!scale || !scale.eventAssignments) return 0;
  return scale.eventAssignments.filter((a: any) => a.active !== false).length;
}

export async function countActiveResponses(scaleId: string) {
  const responses = await getScaleResponses(scaleId);
  return responses.filter((r: any) => r.active !== false).length;
}
