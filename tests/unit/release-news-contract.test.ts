import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

import { shouldAutoPresentRelease } from '../../hooks/useReleaseNews';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('release news contract', () => {
  it('auto-presents only a published unseen feature release', () => {
    const now = Date.parse('2026-09-16T12:00:00Z');
    const base = { id: 'feature-a', publishedAt: '2026-09-16T03:00:00Z' };

    expect(shouldAutoPresentRelease({ ...base, kind: 'feature' }, '', now)).toBe(true);
    expect(shouldAutoPresentRelease({ ...base, kind: 'feature' }, 'feature-a', now)).toBe(false);
    expect(shouldAutoPresentRelease({ ...base, kind: 'hotfix' }, '', now)).toBe(false);
    expect(shouldAutoPresentRelease({ ...base, kind: 'visual' }, '', now)).toBe(false);
    expect(
      shouldAutoPresentRelease(
        { ...base, kind: 'feature', publishedAt: '2026-09-17T03:00:00Z' },
        '',
        now,
      ),
    ).toBe(false);
  });

  it('removes first-access welcome state and legacy welcome storage from UI decisions', () => {
    const news = read('hooks/useNews.ts');
    const presenter = read('components/bootstrap/WelcomeAutoPresenter.tsx');
    const modal = read('components/WhatsNewModal.tsx');

    expect(news).not.toContain('musicscale_welcome_dismissed');
    expect(news).not.toContain('hasSeenOnboarding_v1');
    expect(news).not.toContain('isWelcomeDismissed');
    expect(presenter).toContain('useReleaseNews');
    expect(presenter).toContain('hasUnseenRelease');
    expect(presenter).toContain("pathname === '/stage-tools'");
    expect(modal).not.toContain('WelcomePresentation');
    expect(modal).not.toContain('isFirstAccess');
    expect(modal).not.toContain('Começar a usar');
    expect(modal).not.toContain('Não mostrar novamente');
  });

  it('keeps version labels only in Help and out of navigation/news surfaces', () => {
    const header = read('components/layout/Header.tsx');
    const sidebar = read('components/layout/Sidebar.tsx');
    const highlights = read('components/ReleaseHighlights.tsx');
    const help = read('components/help/HelpModal.tsx');

    expect(header).not.toContain('APP_VERSION');
    expect(sidebar).not.toContain('APP_VERSION');
    expect(highlights).not.toContain('APP_VERSION');
    expect(highlights).not.toContain('FEATURE_RELEASE.version');
    expect(help).toContain('APP_VERSION');
    expect(help).toContain('publicVersion');
    expect(help).toContain('help_modal.version_beta');
    expect(help).toContain('help_modal.version_build');
  });

  it('keeps refinements collapsed and acknowledges only the feature release on close', () => {
    const highlights = read('components/ReleaseHighlights.tsx');
    const modal = read('components/WhatsNewModal.tsx');

    expect(highlights).toContain('<details');
    expect(highlights).toContain('refinements.summary');
    expect(highlights).toContain('refinements.items');
    expect(modal).toContain('markReleaseSeen();');
    expect(modal).not.toContain('markAsSeen');
    expect(modal).not.toContain('dismissWelcome');
  });

  it('preserves modal focus, Escape handling, focus restoration and scroll lock', () => {
    const modal = read('components/WhatsNewModal.tsx');
    expect(modal).toContain("event.key === 'Escape'");
    expect(modal).toContain("document.body.style.overflow = 'hidden'");
    expect(modal).toContain('restoreFocus.focus({ preventScroll: true })');
    expect(modal).toContain("event.key !== 'Tab'");
    expect(modal).toContain('h-[100dvh]');
  });
});
