import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = (file: string) => readFileSync(file, 'utf8');
describe('Global Live Library universal curation contract', () => {
  it('processes new songs from a durable Firebase trigger independent of UI/plan', () => {
    const trigger = source('functions/src/index.ts');
    expect(trigger).toContain("if (!change.before.exists && songData.sourceType !== 'medley')");
    expect(trigger).toContain('ingestNewLocalSong(songId, organizationId, songData');
    expect(source('functions/src/globalSongIngestion.ts')).toContain('status:');
  });
  it('allows only canonical MillionsNest global admin and support roles', () => {
    const backend = source('services/server/ecosystemAuth.ts');
    for (const role of ["'ceo'", "'admin'", "'global_admin'", "'ecosystem_support'"]) {
      expect(backend).toContain(role);
    }
    expect(source('contexts/AuthContext.tsx')).toContain('isCurationAdmin = isGlobalAdmin || isSupportMode');
    const rules = source('firestore.rules');
    expect(rules).toContain('match /globalLibraryCandidates/{candidateId}');
    expect(rules).toContain('isSystemAdmin() || hasCanonicalSupportRole()');
  });
  it('never hard deletes a global library song or customer-owned setlist', () => {
    const catalog = source('services/server/globalCurationCatalog.ts');
    expect(catalog).toContain("status: 'archived'");
    expect(catalog).toContain("action: 'archive_global_song'");
    expect(catalog).not.toContain('tx.delete(');
    expect(catalog).not.toContain("collection('scales')");
  });
});
