import { Page, expect } from '@playwright/test';
import { setupNetworkMocks } from './network';

export async function loginAs(page: Page, email: string, orgId: string, orgName: string, role: string) {
  await setupNetworkMocks(page, orgId, role);
  
  await page.goto('/login');
  
  // Choose Email
  const emailButton = page.getByRole('button', { name: /Acessar com e-mail/i });
  await expect(emailButton).toBeVisible();
  await emailButton.click();
  
  const emailInput = page.getByLabel(/E-mail/i).or(page.getByPlaceholder(/E-mail/i)).first();
  await expect(emailInput).toBeVisible();
  
  await emailInput.fill(email);
  await page.getByLabel(/Senha/i).or(page.getByPlaceholder(/Senha/i)).first().fill('password');
  
  await page.getByRole('button', { name: /Entrar|Acessar/i }).first().click();
  
  // Wait for Dashboard (the app redirects to /)
  await page.waitForURL('**/', { timeout: 15000 });
  
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
