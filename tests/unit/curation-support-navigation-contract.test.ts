import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Global support Curation access is plan independent without tenant bypass', () => {
  const sidebar = readFileSync('components/layout/Sidebar.tsx', 'utf8');
  const app = readFileSync('PrivateApp.tsx', 'utf8');

  it('renders Library/Curation even when support lacks tenant performance capability', () => {
    expect(sidebar).toContain("item.id === 'library' && isCurationAdmin");
    expect(sidebar).toContain("child.id === 'curation_queue') return isCurationAdmin");
  });

  it('lets global staff access only Curation when tenant subscription is suspended', () => {
    expect(app).toContain("isCurationAdmin && (location.pathname === '/curation' || location.pathname.startsWith('/curation/'))");
    expect(app).toContain("if (isSuspended && !isAllowedRouteDuringSuspension)");
  });
});
