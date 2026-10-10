import { defineConfig } from '@playwright/test';

const widths = [360, 375, 390, 430, 768, 1366, 1440];
const contactsConfigured = process.env.UI_TEST_CONTACTS !== 'off';

export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: false,
  workers: 2,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    browserName: 'chromium',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: widths.map((width) => ({
    name: `chromium-${width}`,
    use: { viewport: { width, height: width < 768 ? 844 : 900 } },
  })),
  webServer: {
    command: 'npm run build && npm run start -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ENABLE_MOCK_DATA: 'false',
      APP_ENV: 'development',
      // Reserved fictional numbers, used only by the local test server.
      // These are never application defaults or production business records.
      BUSINESS_PHONE: contactsConfigured ? '+441632960001' : '',
      BUSINESS_WHATSAPP: contactsConfigured ? '+441632960002' : '',
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      STRIPE_SECRET_KEY: '',
      RESEND_API_KEY: '',
      ONEAUTO_API_KEY: '',
    },
  },
});
