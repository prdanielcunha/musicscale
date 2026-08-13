import { Page } from '@playwright/test';

const ADMIN_CAPABILITIES = [
  'scales.read', 'scales.create', 'scales.update', 'scales.delete', 'scales.publish',
  'bandScales.read', 'bandScales.create', 'bandScales.update', 'bandScales.delete',
  'songs.read', 'songs.create', 'songs.update', 'songs.delete',
  'musicians.read', 'musicians.manageMusicalProfile', 'musicians.assignToScale',
  'taxonomy.roles.manage', 'taxonomy.instruments.manage', 'taxonomy.skills.manage',
  'taxonomy.eventTypes.manage', 'taxonomy.eventNames.manage', 'taxonomy.locations.manage', 'taxonomy.tags.manage',
  'notifications.readOwn', 'scaleResponses.respondOwn', 'scaleResponses.readManaged',
  'organization.settings.manage', 'organization.members.manage'
];

const MEMBER_CAPABILITIES = [
  'scales.read',
  'bandScales.read',
  'songs.read',
  'musicians.read',
  'notifications.readOwn',
  'scaleResponses.respondOwn'
];

function resolveAuthenticatedUid(authorization?: string): string | null {
  const token = String(authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) return null;
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8'));
    const uid = String(payload.user_id || payload.sub || '').trim();
    return uid || null;
  } catch {
    return null;
  }
}

function resolveOrganizationRole(uid: string, fallbackRole: string): string {
  if (uid.startsWith('user_leader_')) return 'admin';
  if (uid.startsWith('user_musician_')) return 'member';
  if (uid.startsWith('user_observer_')) return 'visitor';
  return String(fallbackRole || 'visitor').toLowerCase().trim();
}

function resolveCapabilities(role: string): string[] {
  if (role === 'admin' || role === 'owner') return ADMIN_CAPABILITIES;
  if (role === 'member') return MEMBER_CAPABILITIES;
  return [];
}

export async function setupNetworkMocks(page: Page, orgId: string = 'org_a', role: string = 'admin') {
  await page.route('**/*', (route) => {
    const request = route.request();
    const url = request.url();
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      return route.abort('blockedbyclient');
    }

    const hostname = urlObj.hostname;

    // Deterministic local substitutes for optional third-party UI assets.
    // They must not turn an otherwise valid E2E run red just because CI has no external network.
    if (hostname === 'fonts.googleapis.com') {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
    if (hostname === 'fonts.gstatic.com') {
      return route.fulfill({ status: 204, body: '' });
    }
    if (hostname === 'apis.google.com' || hostname === 'accounts.google.com') {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    }

    // Allowlist approach
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Mock the Hub-owned canonical access-context contract with the authenticated E2E identity.
      if (url.includes('/api/v1/ecosystem/access-context')) {
        const uid = resolveAuthenticatedUid(request.headers()['authorization']);
        if (!uid) {
          return route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, reasonCode: 'UNAUTHENTICATED' })
          });
        }

        const organizationRole = resolveOrganizationRole(uid, role);
        const effectiveCapabilities = resolveCapabilities(organizationRole);
        const isOrganizationAdmin = organizationRole === 'admin' || organizationRole === 'owner';
        const accessSource = isOrganizationAdmin
          ? (organizationRole === 'owner' ? 'organization_owner' : 'organization_role')
          : (organizationRole === 'member' ? 'membership' : 'none');

        const effectiveContext = {
          userId: uid,
          organizationId: orgId,
          systemRole: 'viewer',
          organizationRole,
          membershipStatus: 'active',
          musicScaleProfile: null,
          isGlobalAccess: false,
          isOrganizationAdmin,
          isGlobalFullAccess: false,
          isOrganizationFullAccess: isOrganizationAdmin,
          effectiveCapabilities,
          accessSource,
          resolutionStatus: 'resolved',
          version: 2
        };

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            userId: uid,
            organizationId: orgId,
            systemRole: 'viewer',
            organizationRole,
            membershipStatus: 'active',
            musicScaleProfile: null,
            isGlobalAccess: false,
            isOrganizationAdmin,
            effectiveCapabilities,
            accessSource,
            resolutionStatus: 'resolved',
            version: 2,
            effectiveContext
          })
        });
      }

      if (url.includes('/api/v1/organizations/') && url.includes('/limits')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            organizationId: orgId,
            app: 'musicscale',
            plan: 'pro',
            status: 'active',
            features: {
              maxSongs: -1,
              maxScales: -1,
              maxMembers: -1
            },
            limits: { members: -1, songs: -1, storage: -1 },
            usage: { members: 1, songs: 2, storage: 0 },
            entitlementsVersion: 1
          })
        });
      }

      return route.continue();
    }

    // Fail unexpected external network requests explicitly.
    console.error(`Blocked external network request in E2E: ${url}`);
    return route.abort('blockedbyclient');
  });
}
