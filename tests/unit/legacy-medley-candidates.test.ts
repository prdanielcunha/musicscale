import { describe, expect, it } from 'vitest';
import type { MedleyTemplate, Scale, ScaleMedley } from '../../types';
import { collectLegacyMedleyCandidates } from '../../utils/legacyMedleyCandidates';

const arrangement = (id: string, revision = 1): ScaleMedley => ({
  id, revision, anchorSongId: 'source-a', steps: [{
    id: 'excerpt-a', songId: 'source-a', title: 'Primeira Música',
    sourceRevision: 'saved', snapshot: 'G C\nDeus é bom',
    startLine: 0, endLine: 1, repetitions: 1,
  }, {
    id: 'excerpt-b', songId: 'source-b', title: 'Segunda Música',
    sourceRevision: 'saved', snapshot: 'Am D\nMinha fé',
    startLine: 0, endLine: 1, repetitions: 1,
  }],
});
const scale = (organizationId: string | undefined, medleys: ScaleMedley[]): Scale => ({
  id: 'scale', organizationId, date: '2026-10-11', observations: '',
  songIds: ['source-a', 'source-b'], eventTypeId: 'event', locationId: 'local',
  createdBy: { uid: 'adriel', displayName: null, photoURL: null },
  createdAt: '2026-10-11', medleys,
});

const template = (organizationId: string, medley: ScaleMedley): MedleyTemplate => ({
  id: 'template', organizationId, name: 'Medley de Adriel', arrangement: medley,
  createdBy: { uid: 'adriel', displayName: null, photoURL: null },
  createdAt: '2026-10-11',
});

describe('legacy medley discovery for all tenants and creators', () => {
  it('finds historical scale arrangements even without a reusable template', () => {
    const result = collectLegacyMedleyCandidates('org-adriel', [],
      [scale('org-adriel', [arrangement('medley-adriel')])]);
    expect(result).toEqual([{ arrangement: arrangement('medley-adriel'),
      name: 'Primeira Música → Segunda Música', origin: 'scale' }]);
  });

  it('does not expose another organization or infer tenant ownership from a missing ID', () => {
    const list = [
      scale('org-adriel', [arrangement('shared-name')]),
      scale('org-other', [arrangement('other')]),
      scale(undefined, [arrangement('unknown')]),
    ];
    const result = collectLegacyMedleyCandidates('org-adriel',
      [template('org-other', arrangement('wrong'))], list);
    expect(result.map(item => item.arrangement.id)).toEqual(['shared-name']);
  });

  it('deduplicates historical templates and scales by identity, keeping the latest revision', () => {
    const result = collectLegacyMedleyCandidates('org-adriel',
      [template('org-adriel', arrangement('same', 1))],
      [scale('org-adriel', [arrangement('same', 2)])]);
    expect(result).toHaveLength(1);
    expect(result[0].origin).toBe('scale');
    expect(result[0].arrangement.revision).toBe(2);
  });

  it('does not depend on the creator and works with any authorized organization', () => {
    const resultA = collectLegacyMedleyCandidates('org-a', [],
      [scale('org-a', [arrangement('a')])]);
    const resultB = collectLegacyMedleyCandidates('org-b', [],
      [scale('org-b', [arrangement('b')])]);
    expect(resultA.map(item => item.arrangement.id)).toEqual(['a']);
    expect(resultB.map(item => item.arrangement.id)).toEqual(['b']);
  });
});
