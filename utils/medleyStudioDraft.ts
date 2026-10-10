import type { StudioBlock } from './medleyStudioV2';

export interface StudioDraftIdentity { userId: string; organizationId: string; scope: string }
interface SavedDraft {
  version: 1;
  identity: StudioDraftIdentity;
  updatedAt: number;
  blocks: StudioBlock[];
}
const TTL_MS = 12 * 60 * 60 * 1000;
const MAX_CHARS = 30_000;

export function studioDraftKey(identity: StudioDraftIdentity): string {
  return ['musicscale', 'medley-studio-v2', identity.userId, identity.organizationId, identity.scope]
    .map(encodeURIComponent).join(':');
}
/** Session-scoped metadata only. Never store snapshots, lyrics, tabs, auth tokens or permissions. */
export function saveStudioDraft(identity: StudioDraftIdentity, blocks: readonly StudioBlock[], storage: Pick<Storage, 'setItem'>, now = Date.now()): boolean {
  if (!identity.userId || !identity.organizationId || !identity.scope || blocks.length < 1 || blocks.length > 30) return false;
  const record: SavedDraft = { version: 1, identity, updatedAt: now, blocks: blocks.map(block => ({
    id: block.id, songId: block.songId, startLine: block.startLine, endLine: block.endLine,
    label: block.label, repetitions: block.repetitions, key: block.key, bpm: block.bpm,
    transition: block.transition, cue: block.cue,
  })) };
  const serialized = JSON.stringify(record);
  if (serialized.length > MAX_CHARS) return false;
  try { storage.setItem(studioDraftKey(identity), serialized); return true; }
  catch { return false; }
}
export function loadStudioDraft(identity: StudioDraftIdentity, allowedSongIds: ReadonlySet<string>, storage: Pick<Storage, 'getItem' | 'removeItem'>, now = Date.now()): StudioBlock[] | null {
  if (!identity.userId || !identity.organizationId || !identity.scope) return null;
  const key = studioDraftKey(identity);
  try {
    const raw = storage.getItem(key);
    if (!raw || raw.length > MAX_CHARS) return null;
    const parsed = JSON.parse(raw) as SavedDraft;
    if (parsed.version !== 1 || JSON.stringify(parsed.identity) !== JSON.stringify(identity) ||
        !Number.isFinite(parsed.updatedAt) || parsed.updatedAt > now || now - parsed.updatedAt > TTL_MS ||
        !Array.isArray(parsed.blocks) || parsed.blocks.length < 1 || parsed.blocks.length > 30) {
      storage.removeItem(key); return null;
    }
    const ids = new Set<string>();
    if (!parsed.blocks.every(block =>
      block && typeof block.id === 'string' && block.id.length < 100 && !ids.has(block.id) && ids.add(block.id) &&
      typeof block.songId === 'string' && allowedSongIds.has(block.songId) &&
      Number.isInteger(block.startLine) && Number.isInteger(block.endLine) && block.startLine >= 0 &&
      block.endLine >= block.startLine && Number.isInteger(block.repetitions) && block.repetitions >= 1 && block.repetitions <= 8 &&
      typeof block.label === 'string' && block.label.length <= 100 &&
      typeof block.key === 'string' && block.key.length <= 24 &&
      typeof block.bpm === 'string' && block.bpm.length <= 4 &&
      typeof block.cue === 'string' && block.cue.length <= 300 &&
      ['direct', 'hold', 'pause', 'free'].includes(block.transition))) return null;
    return parsed.blocks;
  } catch { return null; }
}
export function clearStudioDraft(identity: StudioDraftIdentity, storage: Pick<Storage, 'removeItem'>): void {
  try { storage.removeItem(studioDraftKey(identity)); } catch { /* storage denied */ }
}
