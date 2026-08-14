import { Page, expect } from '@playwright/test';
import { setupNetworkMocks } from './network';

export async function loginAs(page: Page, email: string, orgId: string, orgName: string, role: string) {
  await setupNetworkMocks(page, orgId, role);

  await page.goto('/login');

  // Mobile/WebKit can remain briefly on the global Ecosystem bootstrap before
  // LoginPage is mounted. Wait for the actual login surface instead of assuming
  // it is available within Playwright's 5s assertion default.
  const emailButton = page.getByRole('button', { name: /Acessar com e-mail/i });
  const emailInput = page.getByRole('textbox', { name: /Endereço de e-mail/i });

  await expect(emailButton.or(emailInput).first()).toBeVisible({ timeout: 20000 });
  if (await emailButton.isVisible()) {
    await emailButton.click();
  }

  await expect(emailInput).toBeVisible({ timeout: 10000 });
  await emailInput.fill(email);

  const passwordInput = page.getByLabel('Senha', { exact: true });
  await expect(passwordInput).toBeVisible();
  await passwordInput.fill('password');

  await page.getByRole('button', { name: 'Acessar Plataforma', exact: true }).click();

  // Wait for Dashboard (the app redirects to /)
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

  // Ensure organization name is visible
  await expect(page.getByText(orgName).first()).toBeVisible({ timeout: 15000 });

  // Dismiss the optional first-use presentation so it cannot intercept later E2E actions.
  const onboardingDismiss = page.getByRole('button', { name: /Começar a usar/i });
  if (await onboardingDismiss.isVisible().catch(() => false)) {
    await onboardingDismiss.click();
    await expect(onboardingDismiss).toBeHidden({ timeout: 5000 });
  }
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
