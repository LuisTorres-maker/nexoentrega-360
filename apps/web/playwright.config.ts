import { defineConfig, devices } from '@playwright/test';

// E2E contra la interfaz (Vite) y la API en Docker Compose (npm run up).
// La base se reinicia al empezar con seeds/000_reset_demo.sql (solo base LOCAL de Docker).
export default defineConfig({
  testDir: '../../tests/e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: '../../tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: '../../test-results/e2e.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: true,
        timeout: 60_000,
      },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
