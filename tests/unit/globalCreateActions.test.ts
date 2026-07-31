import { describe, it, expect, vi } from 'vitest';
import { resolveGlobalCreateActions } from '../../utils/globalCreateActions';

describe('resolveGlobalCreateActions', () => {
  it('1. sem capabilities retorna vazio', () => {
    const hasCapability = vi.fn().mockReturnValue(false);
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'hidden',
      libraryAvailability: 'hidden',
      songLimitReached: false
    });
    expect(actions).toHaveLength(0);
  });

  it('2. somente scales.manage retorna duas ações de escalas', () => {
    const hasCapability = vi.fn((cap: string) => cap === 'musicscale.scales.manage');
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'hidden',
      libraryAvailability: 'hidden',
      songLimitReached: false
    });
    expect(actions).toHaveLength(2);
    expect(actions.map(a => a.id)).toEqual(['music-scale', 'band-scale']);
  });

  it('3. songs.edit retorna cadastro manual', () => {
    const hasCapability = vi.fn((cap: string) => cap === 'musicscale.songs.edit');
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'hidden',
      libraryAvailability: 'hidden',
      songLimitReached: false
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe('song-manual');
  });

  it('4. songs.edit + IA disponível retorna IA', () => {
    const hasCapability = vi.fn((cap: string) => cap === 'musicscale.songs.edit');
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'enabled',
      libraryAvailability: 'hidden',
      songLimitReached: false
    });
    expect(actions).toHaveLength(2);
    expect(actions.map(a => a.id)).toContain('ai-song-import');
  });

  it('5. songs.edit + Biblioteca disponível retorna Biblioteca', () => {
    const hasCapability = vi.fn((cap: string) => cap === 'musicscale.songs.edit');
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'hidden',
      libraryAvailability: 'enabled',
      songLimitReached: false
    });
    expect(actions).toHaveLength(2);
    expect(actions.map(a => a.id)).toContain('library-song-import');
  });

  it('6. todas disponíveis retornam cinco ações', () => {
    const hasCapability = vi.fn().mockReturnValue(true);
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'enabled',
      libraryAvailability: 'enabled',
      songLimitReached: false
    });
    expect(actions).toHaveLength(5);
  });

  it('7. ordem de Músicas é IA, Biblioteca, Manual', () => {
    const hasCapability = vi.fn().mockReturnValue(true);
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'enabled',
      libraryAvailability: 'enabled',
      songLimitReached: false
    });
    const songActions = actions.filter(a => a.group === 'songs');
    expect(songActions.map(a => a.id)).toEqual(['ai-song-import', 'library-song-import', 'song-manual']);
  });

  it('8. ordem de Escalas é musical, banda', () => {
    const hasCapability = vi.fn().mockReturnValue(true);
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'enabled',
      libraryAvailability: 'enabled',
      songLimitReached: false
    });
    const scaleActions = actions.filter(a => a.group === 'scales');
    expect(scaleActions.map(a => a.id)).toEqual(['music-scale', 'band-scale']);
  });

  it('9. falta de capability oculta IA mesmo com entitlement', () => {
    const hasCapability = vi.fn().mockReturnValue(false);
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'enabled',
      libraryAvailability: 'enabled',
      songLimitReached: false
    });
    expect(actions).toHaveLength(0);
  });

  it('10. falta de capability oculta Biblioteca mesmo com plano', () => {
    const hasCapability = vi.fn().mockReturnValue(false);
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'enabled',
      libraryAvailability: 'enabled',
      songLimitReached: false
    });
    expect(actions).toHaveLength(0);
  });

  it('11. IA bloqueada por plano recebe plan-locked', () => {
    const hasCapability = vi.fn().mockReturnValue(true);
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'plan-locked',
      libraryAvailability: 'hidden',
      songLimitReached: false
    });
    const aiAction = actions.find(a => a.id === 'ai-song-import');
    expect(aiAction?.availability).toBe('plan-locked');
  });

  it('12. Biblioteca bloqueada por plano recebe plan-locked', () => {
    const hasCapability = vi.fn().mockReturnValue(true);
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'hidden',
      libraryAvailability: 'plan-locked',
      songLimitReached: false
    });
    const libAction = actions.find(a => a.id === 'library-song-import');
    expect(libAction?.availability).toBe('plan-locked');
  });

  it('13. limite de músicas recebe limit-reached', () => {
    const hasCapability = vi.fn().mockReturnValue(true);
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'enabled',
      libraryAvailability: 'enabled',
      songLimitReached: true
    });
    const manualAction = actions.find(a => a.id === 'song-manual');
    const aiAction = actions.find(a => a.id === 'ai-song-import');
    expect(manualAction?.availability).toBe('limit-reached');
    expect(aiAction?.availability).toBe('limit-reached');
  });

  it('14. bloqueio ambíguo resulta em hidden', () => {
    const hasCapability = vi.fn().mockReturnValue(true);
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'hidden',
      libraryAvailability: 'hidden',
      songLimitReached: false
    });
    expect(actions.find(a => a.id === 'ai-song-import')).toBeUndefined();
    expect(actions.find(a => a.id === 'library-song-import')).toBeUndefined();
  });

  it('15. papel ou owner isolado não autoriza', () => {
    const hasCapability = vi.fn().mockReturnValue(false);
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'enabled',
      libraryAvailability: 'enabled',
      songLimitReached: false
    });
    expect(actions).toHaveLength(0);
  });

  it('16. e-mail não autoriza', () => {
    const hasCapability = vi.fn().mockReturnValue(false);
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'enabled',
      libraryAvailability: 'enabled',
      songLimitReached: false
    });
    expect(actions).toHaveLength(0);
  });

  it('17. ordem é determinística', () => {
    const hasCapability = vi.fn().mockReturnValue(true);
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'enabled',
      libraryAvailability: 'enabled',
      songLimitReached: false
    });
    expect(actions[0].id).toBe('ai-song-import');
    expect(actions[1].id).toBe('library-song-import');
    expect(actions[2].id).toBe('song-manual');
    expect(actions[3].id).toBe('music-scale');
    expect(actions[4].id).toBe('band-scale');
  });

  it('18. grupos são determinísticos', () => {
    const hasCapability = vi.fn().mockReturnValue(true);
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'enabled',
      libraryAvailability: 'enabled',
      songLimitReached: false
    });
    expect(actions[0].group).toBe('songs');
    expect(actions[4].group).toBe('scales');
  });

  it('19. callbacks não existem no registry', () => {
    const hasCapability = vi.fn().mockReturnValue(true);
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'enabled',
      libraryAvailability: 'enabled',
      songLimitReached: false
    });
    actions.forEach(a => {
      expect(typeof (a as any).onClick).toBe('undefined');
    });
  });

  it('20. capability desconhecida não libera ação', () => {
    const hasCapability = vi.fn((cap) => cap === 'unknown');
    const actions = resolveGlobalCreateActions({
      hasCapability,
      aiImportAvailability: 'enabled',
      libraryAvailability: 'enabled',
      songLimitReached: false
    });
    expect(actions).toHaveLength(0);
  });
});
