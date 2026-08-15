import { describe, expect, it } from 'vitest';
import { navigationRegistry } from '../../components/layout/navigationRegistry';
import { hasCanonicalTaxonomyManagement } from '../../hooks/useCapability';
import { buildEffectiveAccessContext } from '../../utils/rbac';

const taxonomyNavigationIds = [
  'structures',
  'overview',
  'types_events',
  'locations',
  'event_names',
  'tags_categories',
  'skills',
];

const organizationAdminNavigationIds = [
  'plans',
  'backup',
  'plan_usage',
  'debug_session',
];

describe('MusicScale taxonomy access contract', () => {
  it('allows a ministry leader to manage taxonomy without organization settings access', () => {
    const leaderContext = buildEffectiveAccessContext(
      'leader-user',
      'org-a',
      'user',
      'leader',
    );

    expect(leaderContext.capabilities.has('taxonomy.instruments.manage')).toBe(true);
    expect(leaderContext.capabilities.has('taxonomy.eventTypes.manage')).toBe(true);
    expect(leaderContext.capabilities.has('taxonomy.locations.manage')).toBe(true);
    expect(leaderContext.capabilities.has('organization.settings.manage')).toBe(false);

    expect(
      hasCanonicalTaxonomyManagement({
        serverContext: { effectiveContext: leaderContext },
      }),
    ).toBe(true);
  });

  it('does not grant taxonomy management to a regular member', () => {
    const memberContext = buildEffectiveAccessContext(
      'member-user',
      'org-a',
      'user',
      'member',
    );

    expect(
      hasCanonicalTaxonomyManagement({
        serverContext: { effectiveContext: memberContext },
      }),
    ).toBe(false);
  });

  it('uses taxonomy permission only for ministry structure navigation', () => {
    for (const id of taxonomyNavigationIds) {
      const item = navigationRegistry.find((entry) => entry.id === id);
      expect(item, `missing navigation item ${id}`).toBeTruthy();
      expect(item?.permissionRequired).toBe('musicscale.taxonomy.manage');
    }

    for (const id of organizationAdminNavigationIds) {
      const item = navigationRegistry.find((entry) => entry.id === id);
      expect(item, `missing navigation item ${id}`).toBeTruthy();
      expect(item?.permissionRequired).toBe('manageOrganization');
    }
  });
});
