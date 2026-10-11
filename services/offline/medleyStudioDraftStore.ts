import Dexie, { type Table } from 'dexie';
import type { StudioBlock } from '../../utils/medleyStudioV2';
import type { StudioDraftIdentity } from '../../utils/medleyStudioDraft';

/** Device-only arrangement metadata. Never cache source charts, lyrics, tabs, snapshots, tokens or permissions. */
export interface DurableMedleyDraft {
  id: string;
  key: string;
  userId: string;
  organizationId: string;
  scope: string;
  name: string;
  editingId: string | null;
  stage: 1 | 2 | 3 | 4;
  activeId: string | null;
  blocks: StudioBlock[];
  revision: number;
  updatedAt: number;
}
export type DraftEditorState = Pick<DurableMedleyDraft, 'name' | 'editingId' | 'stage' | 'activeId' | 'blocks'>;

export class MedleyDraftConflictError extends Error {
  constructor() { super('medleyStudioV2.draftConflict'); this.name = 'MedleyDraftConflictError'; }
}
class MedleyDraftDatabase extends Dexie {
  drafts!: Table<DurableMedleyDraft, string>;
  constructor() {
    // Dedicated database keeps existing offline schemas and sync queues untouched.
    super('MusicScaleMedleyDrafts');
    this.version(1).stores({ drafts: 'key, userId, organizationId, scope, updatedAt' });
  }
}
const db = new MedleyDraftDatabase();
const MAX_DRAFTS_PER_SCOPE = 40;

export function medleyDraftStorageKey(identity: StudioDraftIdentity, id: string): string {
  return [identity.userId, identity.organizationId, identity.scope, id].map(encodeURIComponent).join(':');
}

function assertIdentity(identity: StudioDraftIdentity): void {
  if (!identity.userId || !identity.organizationId || !identity.scope ||
      [identity.userId, identity.organizationId, identity.scope].some(value => value.length > 200)) {
    throw new Error('medleyStudioV2.draftSaveFailed');
  }
}
function sanitizedBlocks(blocks: readonly StudioBlock[]): StudioBlock[] {
  if (!Array.isArray(blocks) || blocks.length > 30) throw new Error('medleyStudioV2.draftSaveFailed');
  const seen = new Set<string>();
  return blocks.map(block => {
    if (!block || typeof block.id !== 'string' || block.id.length > 100 || seen.has(block.id) ||
        typeof block.songId !== 'string' || !block.songId || block.songId.length > 200 ||
        !Number.isInteger(block.startLine) || block.startLine < 0 ||
        !Number.isInteger(block.endLine) || block.endLine < block.startLine ||
        !Number.isInteger(block.repetitions) || block.repetitions < 1 || block.repetitions > 16 ||
        typeof block.label !== 'string' || block.label.length > 100 ||
        typeof block.key !== 'string' || block.key.length > 24 ||
        typeof block.bpm !== 'string' || block.bpm.length > 4 ||
        typeof block.cue !== 'string' || block.cue.length > 300 ||
        !['direct', 'hold', 'pause', 'free'].includes(block.transition)) {
      throw new Error('medleyStudioV2.draftSaveFailed');
    }
    seen.add(block.id);
    return {
      id: block.id, songId: block.songId, startLine: block.startLine, endLine: block.endLine,
      label: block.label, repetitions: block.repetitions, key: block.key, bpm: block.bpm,
      transition: block.transition, cue: block.cue,
      ...(block.manualExtra ? { manualExtra: true } : {}),
    };
  });
}

/** Optimistic revision is checked inside the same IndexedDB transaction as the write. */
export async function saveDurableMedleyDraft(
  identity: StudioDraftIdentity, id: string, editor: DraftEditorState, expectedRevision: number,
): Promise<DurableMedleyDraft> {
  assertIdentity(identity);
  if (!id || id.length > 100 || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new Error('medleyStudioV2.draftSaveFailed');
  }
  const blocks = sanitizedBlocks(editor.blocks);
  if (typeof editor.name !== 'string' || editor.name.length > 120 || ![1, 2, 3, 4].includes(editor.stage) ||
      (editor.activeId !== null && typeof editor.activeId !== 'string') ||
      (editor.editingId !== null && typeof editor.editingId !== 'string')) {
    throw new Error('medleyStudioV2.draftSaveFailed');
  }
  const key = medleyDraftStorageKey(identity, id);
  return db.transaction('rw', db.drafts, async () => {
    const current = await db.drafts.get(key);
    if ((current?.revision || 0) !== expectedRevision) throw new MedleyDraftConflictError();
    if (!current) {
      const count = await db.drafts.where('userId').equals(identity.userId)
        .filter(draft => draft.organizationId === identity.organizationId && draft.scope === identity.scope).count();
      if (count >= MAX_DRAFTS_PER_SCOPE) throw new Error('medleyStudioV2.draftLimitReached');
    }
    const saved: DurableMedleyDraft = {
      id, key, ...identity, name: editor.name, editingId: editor.editingId,
      stage: editor.stage, activeId: editor.activeId, blocks,
      revision: expectedRevision + 1, updatedAt: Date.now(),
    };
    await db.drafts.put(saved);
    return saved;
  });
}

export async function listDurableMedleyDrafts(identity: StudioDraftIdentity): Promise<DurableMedleyDraft[]> {
  assertIdentity(identity);
  const drafts = await db.drafts.where('userId').equals(identity.userId)
    .filter(item => item.organizationId === identity.organizationId && item.scope === identity.scope).toArray();
  return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteDurableMedleyDraft(identity: StudioDraftIdentity, id: string): Promise<void> {
  assertIdentity(identity);
  await db.drafts.delete(medleyDraftStorageKey(identity, id));
}
