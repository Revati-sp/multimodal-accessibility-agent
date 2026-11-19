import { defineConfig, devices } from '@playwright/test';

// Browser smoke tests run against the deterministic DEMO (mock) transport only.
// No Google credentials, gateway, or cloud model are needed. Videos, traces and screenshots
// are disabled so no artefacts are produced.
const PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    video: 'off',
    trace: 'off',
    screenshot: 'off',
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { VITE_TRANSPORT_MODE: 'mock', VITE_MOCK_STEP_DELAY_MS: '150' },
  },
});
