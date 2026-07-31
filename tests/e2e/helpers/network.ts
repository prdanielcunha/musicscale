import { Page } from '@playwright/test';

export async function setupNetworkMocks(page: Page) {
  // Mock any external telemetry or analytics endpoints that shouldn't be called in E2E
  // or that might fail.
  await page.route('**/*', (route) => {
    const url = route.request().url();
    
    // Block third-party analytics/telemetry if any exist and throw error or abort
    if (url.includes('google-analytics.com') || url.includes('analytics')) {
      return route.abort();
    }
    
    // Check for internal API calls that should be mocked
    if (url.includes('/api/v1/ecosystem/access-context')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: "mocked",
          globalRole: "member",
          status: "active",
          organizations: [
            { id: "org_a", role: "admin", status: "active" },
            { id: "org_b", role: "admin", status: "active" }
          ]
        })
      });
    }

    if (url.includes('/api/v1/organizations/') && url.includes('/limits')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: "pro",
          limits: { members: -1, songs: -1, storage: -1 }
        })
      });
    }

    route.continue();
  });
}
