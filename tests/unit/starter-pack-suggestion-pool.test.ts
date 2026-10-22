import { describe, expect, it } from 'vitest';
import { selectStarterPack, validateStarterSelection } from '../../services/server/onboarding/firstScaleOnboardingService';

const curated = Array.from({ length: 12 }, (_, i) => ({
  id: `curated-${i}`, title: `Canção ${i}`, artist: 'Artista', status: 'active',
  onboardingStarter: true, onboardingStarterRank: i + 1, language: 'pt'
}));
const active = Array.from({ length: 30 }, (_, i) => ({
  id: `popular-${i}`, title: `Louvor ${i}`, artist: 'Artista', status: 'active',
  language: 'pt', importCount: 30 - i
}));
const docs = (items: Array<{ id: string }>) =>
  items.map(song => ({ id: song.id, data: () => song }));
const db = {
  collection: () => ({
    where: (field: string) => ({
      get: async () => ({ docs: docs(field === 'onboardingStarter' ? curated : active) }),
      limit: () => ({ get: async () => ({ docs: docs(active) }) })
    })
  })
};

describe('starter pack expanded suggestions', () => {
  it('preserves the first ten and only authorizes eligible choices within a bounded pool', async () => {
    const initial = await selectStarterPack(db);
    const pool = await selectStarterPack(db, 30);
    expect(initial).toHaveLength(10);
    expect(pool).toHaveLength(30);
    expect(pool.slice(0, 10).map(song => song.id)).toEqual(initial.map(song => song.id));
    expect(new Set(pool.map(song => song.id)).size).toBe(30);
    expect(validateStarterSelection([pool[20].id], pool).valid).toBe(true);
    expect(validateStarterSelection(Array.from({ length: 11 }, (_, i) => pool[i].id), pool).valid).toBe(false);
    expect(validateStarterSelection(['not-in-pool'], pool).valid).toBe(false);
  });
});
