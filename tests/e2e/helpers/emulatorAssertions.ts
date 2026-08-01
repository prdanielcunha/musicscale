import admin from 'firebase-admin';

function getDb() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST is missing! This is dangerous as it might connect to production.');
  }
  if (process.env.GCLOUD_PROJECT !== 'demo-musicscale') {
    throw new Error('GCLOUD_PROJECT must be demo-musicscale');
  }
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: process.env.GCLOUD_PROJECT
    });
  }
  return admin.firestore();
}

export interface ScaleData {
  id: string;
  organizationId: string;
  title: string;
  date: string;
  time: string;
  status: string;
  songIds: string[];
  publishRevision?: number;
  eventAssignments?: any[];
}

export interface ScaleResponseData {
  id: string;
  userId: string;
  status: string;
  reason?: string;
  active: boolean;
  assignmentRevision?: number;
  responseRevision?: number;
  respondedAgainstRevision?: number;
}

export interface NotificationData {
  id: string;
  recipientId: string;
  organizationId: string;
  type: string;
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  isArchived: boolean;
  publishRevision?: number;
  sourceEventId?: string;
  metadata?: {
    musicScaleId?: string;
    publishRevision?: number;
  };
}

export interface ResponseHistoryData {
  id: string;
  organizationId: string;
  musicScaleId: string;
  userId: string;
  eventAssignmentIds: string[];
  newStatus: string;
  reasonProvided: boolean;
  createdAt: any;
}

export async function getScaleSnapshot(scaleId: string): Promise<ScaleData | null> {
  const db = getDb();
  const doc = await db.collection('scales').doc(scaleId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as ScaleData;
}

export async function getScaleResponses(scaleId: string): Promise<ScaleResponseData[]> {
  const db = getDb();
  const snap = await db.collection('scales').doc(scaleId).collection('responses').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as ScaleResponseData[];
}

export async function getScaleResponseHistory(scaleId: string): Promise<ResponseHistoryData[]> {
  const db = getDb();
  const snap = await db.collection('scales').doc(scaleId).collection('responseHistory').orderBy('createdAt', 'asc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as ResponseHistoryData[];
}

export async function getOrganizationNotifications(orgId: string): Promise<NotificationData[]> {
  const db = getDb();
  const snap = await db.collection('organizations').doc(orgId).collection('notifications').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as NotificationData[];
}

export async function getBandScaleSnapshot(bandScaleId: string): Promise<any> {
  const db = getDb();
  const doc = await db.collection('bandScales').doc(bandScaleId).get();
  return doc.exists ? doc.data() : null;
}

export async function countNotificationsForScale(orgId: string, scaleId: string): Promise<number> {
  const notifications = await getOrganizationNotifications(orgId);
  return notifications.filter(n => n.metadata?.musicScaleId === scaleId || n.sourceEventId === scaleId).length;
}

export async function findNotification(
  orgId: string,
  criteria: { sourceEventId?: string; recipientId?: string; publishRevision?: number }
): Promise<NotificationData | null> {
  const notifications = await getOrganizationNotifications(orgId);
  const found = notifications.find(n => {
    if (criteria.sourceEventId && n.sourceEventId !== criteria.sourceEventId && n.metadata?.musicScaleId !== criteria.sourceEventId) return false;
    if (criteria.recipientId && n.recipientId !== criteria.recipientId) return false;
    if (criteria.publishRevision !== undefined && n.publishRevision !== criteria.publishRevision && n.metadata?.publishRevision !== criteria.publishRevision) return false;
    return true;
  });
  return found || null;
}

export async function countActiveResponses(scaleId: string): Promise<number> {
  const responses = await getScaleResponses(scaleId);
  return responses.filter(r => r.active === true).length;
}

export async function countActiveAssignments(bandScaleId: string): Promise<number> {
  const snap = await getBandScaleSnapshot(bandScaleId);
  if (!snap || !snap.assignments) return 0;
  return snap.assignments.length;
}
