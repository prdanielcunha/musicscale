import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';

export interface SharedContext {
  organizationId: string;
  organizationName: string;
  profileName: string;
}

export interface SharedScale {
  id: string;
  date: string;
  time?: string;
  eventName?: string;
  locationName?: string;
  songIds: string[];
  songs: Array<{ id: string; title: string; artist?: string }>;
}

function resolveOrganizationId(profile: Record<string, unknown>): string | null {
  const candidates = [
    profile.activeOrganizationId,
    profile.organizationId,
    profile.primaryOrganizationId
  ];
  return candidates.find(value => typeof value === 'string' && value.length > 0) as string | null;
}

export async function loadSharedContext(user: User): Promise<SharedContext | null> {
  const userSnap = await getDoc(doc(db, 'users', user.uid));
  if (!userSnap.exists()) return null;

  const profile = userSnap.data();
  const organizationId = resolveOrganizationId(profile);
  if (!organizationId) return null;

  const orgSnap = await getDoc(doc(db, 'organizations', organizationId));
  const org = orgSnap.exists() ? orgSnap.data() : {};

  return {
    organizationId,
    organizationName: String(org.name || 'Organização'),
    profileName: String(profile.displayName || user.displayName || user.email || '')
  };
}

export async function loadNextScale(organizationId: string): Promise<SharedScale | null> {
  const [scaleSnap, songSnap, eventNamesSnap, locationsSnap] = await Promise.all([
    getDocs(query(collection(db, 'scales'), where('organizationId', '==', organizationId))),
    getDocs(query(collection(db, 'songs'), where('organizationId', '==', organizationId))),
    getDocs(query(collection(db, 'eventNames'), where('organizationId', '==', organizationId))),
    getDocs(query(collection(db, 'locations'), where('organizationId', '==', organizationId)))
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const scales = scaleSnap.docs
    .map(item => ({ id: item.id, ...item.data() } as Record<string, any>))
    .filter(item => String(item.date || '') >= today && item.status !== 'cancelled')
    .sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`));

  const next = scales[0];
  if (!next) return null;

  const songsById = new Map(songSnap.docs.map(item => [item.id, item.data()]));
  const eventNamesById = new Map(eventNamesSnap.docs.map(item => [item.id, item.data()]));
  const locationsById = new Map(locationsSnap.docs.map(item => [item.id, item.data()]));
  const songIds = Array.isArray(next.songIds) ? next.songIds : [];

  return {
    id: String(next.id),
    date: String(next.date || ''),
    time: next.time ? String(next.time) : undefined,
    eventName: next.eventNameId ? String(eventNamesById.get(next.eventNameId)?.name || '') : undefined,
    locationName: next.locationId ? String(locationsById.get(next.locationId)?.name || '') : undefined,
    songIds,
    songs: songIds.map((id: string) => {
      const song = songsById.get(id) || {};
      return { id, title: String(song.title || 'Música'), artist: song.artist ? String(song.artist) : undefined };
    })
  };
}
