import { Page, expect } from '@playwright/test';
import { setupNetworkMocks } from './network';

export async function loginAs(page: Page, email: string, orgId: string, orgName: string, role: string) {
  await setupNetworkMocks(page, orgId, role);

  // Keep UI assertions deterministic across Chromium/WebKit runners regardless
  // of the host locale. Product i18n remains untouched; this only selects the
  // Portuguese locale already supported by the app for this E2E suite.
  // Also mark the first-use presentation as already seen before React mounts.
  // The modal intentionally auto-opens 500 ms after hydration, so dismissing it
  // only after login creates a race where it can intercept later E2E clicks.
  await page.addInitScript(() => {
    window.localStorage.setItem('millionsnest_i18n_lng', 'pt');
    window.localStorage.setItem('i18nextLng', 'pt-BR');
    window.localStorage.setItem('musicscale_welcome_dismissed', 'true');
    window.localStorage.setItem('hasSeenOnboarding_v1', 'true');
  });

  await page.goto('/login');
  await page.waitForURL('**/login');

  // /login is a public authentication surface and must mount independently of
  // tenant/ecosystem hydration. Prefer stable DOM ids once the email form opens.
  const emailButton = page.getByRole('button', { name: /Acessar com e-mail/i });
  const emailInput = page.locator('#login-email');

  await expect(emailButton.or(emailInput).first()).toBeVisible({ timeout: 10000 });
  if (await emailButton.isVisible().catch(() => false)) {
    await emailButton.click();
  }

  await expect(emailInput).toBeVisible({ timeout: 5000 });
  await emailInput.fill(email);

  const passwordInput = page.locator('#login-password');
  await expect(passwordInput).toBeVisible({ timeout: 5000 });
  await passwordInput.fill('password');

  const submit = page.locator('form button[type="submit"]').first();
  await expect(submit).toBeVisible({ timeout: 5000 });
  await submit.click();

  // Login intentionally transitions through /start while ecosystem context is
  // hydrated, and then reaches the canonical workspace at /.
  await page.waitForURL('**/', { timeout: 20000 });

  // Ensure no blocking screens are visible. Check for their real texts, not component names.
  const content = await page.innerHTML('body');
  if (
    content.includes('plano atual') ||
    content.includes('Assinatura') && content.includes('inativa') ||
    content.includes('timeout') ||
    content.includes('Erro de carregamento') ||
    content.includes('Acesso Negado')
  ) {
    throw new Error('Blocked by subscription, onboarding, timeout, or access denied screen.');
  }

  // The shell/header can show the organization before MusicData, suggestions and
  // the home experience finish hydrating. DashboardPage renders only skeletons
  // until those providers are all ready, and its real content always has a main
  // level-1 heading. Waiting for both prevents feature tests from racing the seed.
  await expect(page.getByText(orgName).first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator('main').getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20000 });

  // Dismiss any future announcement that may legitimately appear despite the
  // first-use flags above (for example a new dynamic announcement).
  const onboardingDismiss = page.getByRole('button', { name: /Começar a usar/i });
  if (await onboardingDismiss.isVisible().catch(() => false)) {
    await onboardingDismiss.click();
    await expect(onboardingDismiss).toBeHidden({ timeout: 5000 });
  }

  // From this point onward the E2E base fixture may route internally without a
  // full document reload. This preserves the proven hydrated providers and avoids
  // WebKit cancelling lazy module requests during hard page.goto transitions.
  (page as any)._musicscaleClientNavigationReady = true;
}

export async function loginAsLeaderA(page: Page) {
  await loginAs(page, 'leader@orga.test', 'org_a', 'Família Teste A', 'admin');
}

export async function loginAsLeaderB(page: Page) {
  await loginAs(page, 'leader@orgb.test', 'org_b', 'Família Teste B', 'admin');
}

export async function loginAsMusicianA(page: Page) {
  await loginAs(page, 'musician@orga.test', 'org_a', 'Família Teste A', 'member');
}

export async function loginAsObserverA(page: Page) {
  await loginAs(page, 'observer@orga.test', 'org_a', 'Família Teste A', 'visitor');
}
