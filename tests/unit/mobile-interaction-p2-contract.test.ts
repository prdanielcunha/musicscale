import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('mobile interaction P2 contract', () => {
  it('resolves the welcome preference synchronously and preloads first-access UI', () => {
    const news = read('hooks/useNews.ts');
    const app = read('App.tsx');

    expect(news).toContain('useState<string[]>(readStoredSeenNewsIds)');
    expect(news).toContain('useState<boolean>(readStoredWelcomeDismissed)');
    expect(news).not.toContain('default true until loaded to prevent flash');
    expect(news).not.toContain('setIsLoaded');

    expect(app).toContain('preloadFirstAccessWelcome');
    expect(app).toContain("void import('./components/WhatsNewModal')");
  });

  it('keeps automatic welcome state isolated from the global modal context', () => {
    const privateApp = read('PrivateApp.tsx');
    const presenter = read('components/bootstrap/WelcomeAutoPresenter.tsx');

    expect(privateApp).toContain('<WelcomeAutoPresenter />');
    expect(privateApp).not.toContain('setTimeout(() => {\n                openWhatsNew();');
    expect(privateApp).not.toContain("import { useNews } from './hooks/useNews'");
    expect(privateApp).not.toContain("import { useModals } from './contexts/ModalContext'");

    expect(presenter).toContain('const [isOpen, setIsOpen] = useState(false)');
    expect(presenter).toContain('setIsOpen(true)');
    expect(presenter).toContain('onClose={() => setIsOpen(false)}');
  });

  it('removes persistent WebKit backdrop/filter pressure from the mobile shell', () => {
    const privateApp = read('PrivateApp.tsx');
    const header = read('components/layout/Header.tsx');
    const bottomNav = read('components/layout/BottomNav.tsx');

    expect(privateApp).toContain('md:hidden bg-[radial-gradient');
    expect(privateApp).not.toContain('bg-blue-500/5 blur-[120px]');
    expect(privateApp).not.toContain('bg-violet-500/5 blur-[140px]');
    expect(privateApp).toContain('md:backdrop-blur-md');

    expect(header).toContain('bg-[#0a0a0c]/96');
    expect(header).toContain('md:backdrop-blur-[32px]');
    expect(header).not.toContain('bg-[#0a0a0c]/88 backdrop-blur-xl');

    expect(bottomNav).not.toContain('backdrop-blur-[24px]');
    expect(bottomNav).not.toContain('backdrop-blur-[16px]');
    expect(bottomNav).toContain('rgba(24,24,29,0.98)');
  });

  it('keeps the welcome modal mobile surface opaque and its close transition short', () => {
    const modal = read('components/WhatsNewModal.tsx');

    expect(modal).toContain('bg-black/78 sm:bg-black/55 sm:backdrop-blur-md');
    expect(modal).not.toContain('bg-black/55 backdrop-blur-md');
    expect(modal).not.toContain('md:blur-[60px] blur-[15px]');
    expect(modal).toContain('transition={{ duration: 0.16');
    expect(modal).toContain("beginInteractionPaintMeasurement('welcome_close_to_paint_ms')");
    expect(modal).toContain('restoreFocus.focus({ preventScroll: true })');
  });

  it('paints the drawer closed before applying inert to its large subtree', () => {
    const drawer = read('components/layout/MobileSidebarDrawer.tsx');

    expect(drawer).toContain('const [isInteractive, setIsInteractive] = useState(false)');
    expect(drawer).toContain('setIsOpen(false)');
    expect(drawer).toContain('setIsInteractive(false)');
    expect(drawer).toContain('DRAWER_TRANSITION_MS + 20');
    expect(drawer).toContain('inert={!isInteractive}');
    expect(drawer).toContain("beginInteractionPaintMeasurement('mobile_drawer_close_to_paint_ms')");
  });

  it('keeps real-device interaction telemetry bounded and content-free', () => {
    const telemetry = read('lib/interactionTelemetry.ts');
    const publisher = read('hooks/useEcosystemTelemetry.ts');

    expect(telemetry).toContain('MAX_SNAPSHOT_EVENTS = 20');
    expect(telemetry).toContain('requestAnimationFrame');
    expect(telemetry).toContain("storageKey = 'musicscale:interaction-snapshot'");
    expect(publisher).toContain("category: 'interaction_performance'");
    expect(publisher).toContain('metric: e.detail.metric');
    expect(publisher).toContain('value: e.detail.value');
  });
});
