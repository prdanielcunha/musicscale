import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('Premium V2 full experience contract', () => {
  it('keeps mobile navigation adaptive, contextual, five-slot and immersive-surface aware', () => {
    const source = read('components/layout/BottomNav.tsx');
    expect(source).toContain('const COMPACT_AFTER_PX = 92');
    expect(source).toContain('const isContextRoute = /^\\/scales\\/[^/]+/.test(location.pathname)');
    expect(source).toContain('data-testid="adaptive-bottom-nav"');
    expect(source).toContain('data-compact={isCompact ? "true" : "false"}');
    expect(source).toContain('data-context={isContextRoute ? "scale" : "global"}');
    expect(source).toContain('document.querySelector(\'[data-testid="close-chords-viewer"]\')');
    expect(source).not.toContain('document.body.style.overflow === "hidden"');
    expect(source).not.toContain('attributeFilter: ["style"]');
    expect(source).toContain('if (isPerformanceActive) return null');
    expect(source.match(/id: "(dashboard|songs|scales|library)"/g)).toHaveLength(4);
    expect(source).toContain('<GlobalCreateAction variant="mobile" />');
    expect(source).toContain('min-w-[44px]');
    expect(source).toContain('data-testid="mobile-create-highlight"');
    expect(source).not.toContain('before:rounded-full');
    expect(source).not.toContain('before:shadow-');
    expect(source).not.toContain('animate-pulse');
  });

  it('keeps contextual future greetings short instead of treating the event weekday as today', () => {
    const greetings = read('locales/dashboardGreetings.ts');
    const i18n = read('lib/i18n.ts');
    expect(greetings).toContain("assigned_future_title: 'Olá, {{name}}.'");
    expect(greetings).toContain("leader_future_title: 'Olá, {{name}}.'");
    expect(greetings).toContain("assigned_future_title: 'Hello, {{name}}.'");
    expect(greetings).toContain("assigned_future_title: 'Hola, {{name}}.'");
    expect(greetings).not.toContain('Bom {{weekday}}');
    expect(i18n).toContain('dashboardGreetingTranslations');
    expect(i18n).toContain('...dashboardGreetings');
  });

  it('makes the header react to the real workspace scroll container and keeps iPhone chrome compositor-cheap', () => {
    const source = read('components/layout/Header.tsx');
    const css = read('premium-v2-completion.css');
    expect(source).toContain('document.querySelector("main")');
    expect(source).toContain('scrollContainer.scrollTop > 10');
    expect(source).toContain('ms-v3-header');
    expect(source).toContain('is-scrolled');
    expect(source).toContain('bg-[#0a0a0c]/96');
    expect(source).toContain('md:backdrop-blur-[32px]');
    expect(source).not.toContain('window.scrollY > 10');
    expect(css).toContain('-webkit-backdrop-filter: none');
    expect(css).toContain('@media (min-width: 768px)');
    expect(css).toContain('backdrop-filter: blur(18px) saturate(138%)');
  });

  it('treats tablet as an explicit workspace and resolves lazy routes with content-shaped skeletons', () => {
    const shell = read('PrivateApp.tsx');
    expect(shell).toContain('(min-width: 768px) and (max-width: 1180px)');
    expect(shell).toContain("data-device-layout={deviceLayout}");
    expect(shell).toContain('<RouteWorkspaceSkeleton pathname={location.pathname} />');
    expect(shell).not.toContain('Suspense fallback={<div className="flex h-64 w-full items-center justify-center"><Spinner size="lg" /></div>}');

    const skeleton = read('components/common/RouteWorkspaceSkeleton.tsx');
    expect(skeleton).toContain('<MusicWorkspaceSkeleton />');
    expect(skeleton).toContain('<OperationalWorkspaceSkeleton variant="scales" />');
    expect(skeleton).toContain('data-testid="route-workspace-skeleton"');
  });

  it('adds Biblioteca mobile gestures without removing the accessible import fallback', () => {
    const card = read('components/library/LibrarySongCard.tsx');
    expect(card).toContain('const LONG_PRESS_MS = 440');
    expect(card).toContain('const SWIPE_ADD_THRESHOLD_PX = 72');
    expect(card).toContain("style={{ touchAction: 'pan-y' }}");
    expect(card).toContain('onPointerDown={handlePointerDown}');
    expect(card).toContain('onPointerUp={handlePointerUp}');
    expect(card).toContain('onImport(song, e');
    expect(card).toContain("t('library.import_btn', 'Importar')");
  });

  it('keeps new Premium V2 copy available in PT EN and ES and retains curation modal parity', () => {
    const locale = read('locales/premiumV2.ts');
    expect(locale).toContain('pt: {');
    expect(locale).toContain('en: {');
    expect(locale).toContain('es: {');
    expect(locale).toContain("gestureHint: 'Deslize para adicionar");
    expect(locale).toContain("gestureHint: 'Swipe to add");
    expect(locale).toContain("gestureHint: 'Desliza para añadir");

    const i18n = read('lib/i18n.ts');
    expect(i18n).toContain('premiumV2: premium');
    expect(i18n).toContain('gesture_release_to_add');
    expect(i18n).toContain('modals: curationModalTranslations.pt');
    expect(i18n).toContain('modals: curationModalTranslations.en');
    expect(i18n).toContain('modals: curationModalTranslations.es');
  });

  it('removes targeted single-language copy from the chord and lyric catalog workspaces', () => {
    const chords = read('pages/ChordsPage.tsx');
    const lyrics = read('pages/LyricsPage.tsx');
    for (const source of [chords, lyrics]) {
      expect(source).toContain("t('premiumV2.musicWorkspace.search')");
      expect(source).toContain("t('premiumV2.musicWorkspace.allKeys')");
      expect(source).not.toContain('Buscar por título ou artista...');
      expect(source).not.toContain('Todos os tons');
      expect(source).not.toContain('Mais Recentes');
    }
  });

  it('keeps Performance instrument-like and confirms exit from the real worship/live state', () => {
    const performance = read('components/songs/ChordsViewerModal.tsx');
    expect(performance).toContain('const handleSafeClose = () => {');
    expect(performance).toContain('isWorshipFlow || liveSession?.mode === "worship"');
    expect(performance).toContain('t("premiumV2.performance.exitConfirm")');
    expect(performance).toContain('data-testid="close-chords-viewer"');
    expect(performance).toContain('navigator as any).wakeLock.request("screen")');
    expect(performance).toContain('setIsAutoScrolling');
    expect(performance).toContain('StagePad');
  });

  it('presents scale song clusters as a numbered musical timeline without replacing scale handlers', () => {
    const css = read('premium-v2-completion.css');
    const scales = read('pages/ScalesPage.tsx');
    expect(css).toContain('counter-reset: ms-scale-song');
    expect(css).toContain('counter(ms-scale-song, decimal-leading-zero)');
    expect(css).toContain('[data-testid^="scale-card-"]');
    expect(scales).toContain('handleQuickRemove(song.id)');
    expect(scales).toContain('songsExpanded ? scale.songs : scale.songs.slice(0, 3)');
  });

  it('loads the dedicated completion layer and preserves reduced-motion rules', () => {
    const entry = read('index.tsx');
    const css = read('premium-v2-completion.css');
    const button = read('components/common/Button.tsx');
    expect(entry).toContain("import './premium-v2-completion.css';");
    expect(css).toContain('[data-device-layout="tablet"]');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.premium-interactive:active:not(:disabled)');
    expect(button).toContain('motion-reduce:transition-none');
    expect(button).toContain('motion-reduce:active:scale-100');
  });
});
