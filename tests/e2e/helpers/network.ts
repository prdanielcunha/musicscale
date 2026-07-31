import { Page } from '@playwright/test';

export async function setupNetworkMocks(page: Page, orgId: string = 'org_a', role: string = 'admin') {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    let urlObj;
    try {
      urlObj = new URL(url);
    } catch {
      return route.abort('blockedbyclient');
    }
    
    const hostname = urlObj.hostname;
    
    // Allowlist approach
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      
      // Mock /api/v1/ecosystem/access-context
      if (url.includes('/api/v1/ecosystem/access-context')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            userId: "mocked",
            globalRole: "member",
            status: "active",
            organizations: [
              { id: orgId, role, status: "active" }
            ]
          })
        });
      }

      if (url.includes('/api/v1/organizations/') && url.includes('/limits')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            organizationId: orgId,
            app: "musicscale",
            plan: "pro",
            status: "active",
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
    
    // Fail external network requests explicitly
    console.error(`Blocked external network request in E2E: ${url}`);
    return route.abort('blockedbyclient');
  });
}
