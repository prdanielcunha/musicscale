import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe
} from 'firebase/firestore';
import type {
  AutomationRule,
  LiveEvent,
  LiveRequest,
  LiveSession,
  ProviderLink,
  Scene,
  ServicePlan
} from '@musicscale-live/domain';
import { db } from './firebase';

export const LIVE_COLLECTIONS = {
  venues: 'musicScaleLiveVenues',
  systems: 'musicScaleLiveSystems',
  nodes: 'musicScaleLiveNodes',
  profiles: 'musicScaleLiveProfiles',
  scenes: 'musicScaleLiveScenes',
  automations: 'musicScaleLiveAutomations',
  providerLinks: 'musicScaleLiveProviderLinks',
  servicePlans: 'musicScaleLiveServicePlans',
  sessions: 'musicScaleLiveSessions',
  requests: 'musicScaleLiveRequests',
  events: 'musicScaleLiveEvents',
  mediaAssets: 'musicScaleLiveMediaAssets'
} as const;

function stableDocId(parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .join('__')
    .replace(/[^a-zA-Z0-9_.:-]/g, '_')
    .slice(0, 900);
}

export async function syncPreparedServicePlan(
  plan: ServicePlan,
  providerLinks: ProviderLink[],
  actorId: string
): Promise<void> {
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  batch.set(doc(db, LIVE_COLLECTIONS.servicePlans, plan.id), {
    ...plan,
    updatedAt: now,
    updatedBy: actorId
  }, { merge: true });

  for (const link of providerLinks) {
    const id = link.id || stableDocId([
      link.organizationId,
      link.venueId,
      link.providerInstanceId,
      link.musicScaleEntityId,
      link.externalId
    ]);
    batch.set(doc(db, LIVE_COLLECTIONS.providerLinks, id), {
      ...link,
      id,
      updatedAt: now,
      updatedBy: actorId
    }, { merge: true });
  }

  await batch.commit();
}

export async function upsertLiveSession(
  session: LiveSession,
  actorId: string
): Promise<void> {
  await setDoc(doc(db, LIVE_COLLECTIONS.sessions, session.id), {
    ...session,
    startedBy: actorId,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId
  }, { merge: true });
}

export async function appendLiveEvent(event: LiveEvent): Promise<void> {
  await setDoc(doc(db, LIVE_COLLECTIONS.events, event.id), event);
}

export async function listScenes(
  organizationId: string,
  venueId?: string,
  liveSystemId?: string
): Promise<Scene[]> {
  const snapshot = await getDocs(query(
    collection(db, LIVE_COLLECTIONS.scenes),
    where('organizationId', '==', organizationId)
  ));

  return snapshot.docs
    .map(item => item.data() as Scene)
    .filter(scene => !venueId || scene.venueId === venueId)
    .filter(scene => !liveSystemId || !scene.liveSystemId || scene.liveSystemId === liveSystemId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveScene(scene: Scene, actorId: string): Promise<void> {
  await setDoc(doc(db, LIVE_COLLECTIONS.scenes, scene.id), {
    ...scene,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId
  }, { merge: true });
}

export async function removeScene(sceneId: string): Promise<void> {
  await deleteDoc(doc(db, LIVE_COLLECTIONS.scenes, sceneId));
}

export async function listAutomations(
  organizationId: string,
  venueId?: string
): Promise<AutomationRule[]> {
  const snapshot = await getDocs(query(
    collection(db, LIVE_COLLECTIONS.automations),
    where('organizationId', '==', organizationId)
  ));

  return snapshot.docs
    .map(item => item.data() as AutomationRule)
    .filter(rule => !venueId || rule.venueId === venueId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveAutomation(
  rule: AutomationRule,
  actorId: string
): Promise<void> {
  await setDoc(doc(db, LIVE_COLLECTIONS.automations, rule.id), {
    ...rule,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId
  }, { merge: true });
}

export async function createCloudLiveRequest(request: LiveRequest): Promise<void> {
  await setDoc(doc(db, LIVE_COLLECTIONS.requests, request.id), request);
}

export async function resolveCloudLiveRequest(
  requestId: string,
  status: 'accepted' | 'rejected' | 'completed',
  actorId: string
): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, LIVE_COLLECTIONS.requests, requestId), {
    status,
    updatedAt: now,
    resolvedAt: status === 'accepted' ? null : now,
    resolvedBy: actorId
  });
}

export function subscribeCloudLiveRequests(
  organizationId: string,
  liveSessionId: string,
  onChange: (requests: LiveRequest[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, LIVE_COLLECTIONS.requests),
    where('organizationId', '==', organizationId)
  );

  return onSnapshot(q, snapshot => {
    const requests = snapshot.docs
      .map(item => item.data() as LiveRequest)
      .filter(item => item.liveSessionId === liveSessionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    onChange(requests);
  }, error => onError?.(error));
}
