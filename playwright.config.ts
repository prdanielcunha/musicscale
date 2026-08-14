import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // The release flows intentionally exercise several real UI/API transitions.
  // Keep per-action/assertion timeouts strict while giving slower WebKit devices
  // enough total test budget to finish deterministic successful workflows.
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Deterministic tests in CI
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-results.json' }]
  ],
  globalSetup: './tests/e2e/helpers/globalSetup.ts',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'tablet-webkit',
      use: { ...devices['iPad Mini'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_E2E_MODE: 'true',
      VITE_E2E_FIREBASE_PROJECT_ID: 'demo-musicscale',
      VITE_E2E_AUTH_EMULATOR_HOST: '127.0.0.1',
      VITE_E2E_AUTH_EMULATOR_PORT: '9099',
      VITE_E2E_FIRESTORE_EMULATOR_HOST: '127.0.0.1',
      VITE_E2E_FIRESTORE_EMULATOR_PORT: '8080',
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080'
    }
  },
});
