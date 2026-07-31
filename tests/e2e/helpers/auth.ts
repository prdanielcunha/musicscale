import { Page, expect } from '@playwright/test';
import { setupNetworkMocks } from './network';

export async function loginAs(page: Page, email: string) {
  await setupNetworkMocks(page);
  
  await page.goto('/login');
  
  // Choose Email
  await page.click('button:has-text("Acessar com e-mail")');
  await page.waitForSelector('input[type="email"]');
  
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'password');
  
  await page.click('button[type="submit"]');
  
  // Wait for Dashboard (the app redirects to /)
  await page.waitForURL('**/', { timeout: 15000 });
  
  // Ensure no blocking screens are visible
  const content = await page.innerHTML('body');
  if (content.includes('MissingSubscriptionScreen') || content.includes('BOOTSTRAP_TIMEOUT') || content.includes('TenantOnboarding')) {
    throw new Error('Blocked by subscription, onboarding, or timeout screen.');
  }
}

export async function loginAsLeaderA(page: Page) {
  await loginAs(page, 'leader@orga.test');
}

export async function loginAsLeaderB(page: Page) {
  await loginAs(page, 'leader@orgb.test');
}

export async function loginAsMusicianA(page: Page) {
  await loginAs(page, 'musician@orga.test');
}
